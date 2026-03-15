/**
 * Bulk import module for pulling entire chat history from ChatGPT or Claude.
 *
 * Runs in the service-worker context. Uses chrome.scripting.executeScript with
 * world: 'MAIN' to read page-context variables (access tokens, cookies).
 */

import { IngestPayload } from '../types/message';
import { getSettings } from './storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BulkImportProgress {
  phase: 'fetching_token' | 'listing' | 'fetching' | 'sending' | 'done' | 'error';
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (progress: BulkImportProgress) => void;

export interface BulkImportResult {
  imported: number;
  skipped: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cancellation flag — set externally via cancelImport(). */
let cancelled = false;

export function cancelImport(): void {
  cancelled = true;
}

export function resetCancelFlag(): void {
  cancelled = false;
}

function checkCancelled(): void {
  if (cancelled) {
    throw new CancelledError();
  }
}

export class CancelledError extends Error {
  constructor() {
    super('Import cancelled by user');
    this.name = 'CancelledError';
  }
}

/** Throttle helper: wait 600-1000ms (600 + random 0-400ms jitter). */
function throttle(): Promise<void> {
  const ms = 600 + Math.floor(Math.random() * 400);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Send a batch of IngestPayloads to the WIMS server. Max 100 per call. */
async function sendBatch(
  serverUrl: string,
  apiKey: string,
  messages: IngestPayload[],
): Promise<{ received: number; imported: number; skipped_duplicates: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${serverUrl}/api/v1/ingest/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      throw new Error('AUTH_ERROR');
    }
    if (response.status === 429) {
      throw new Error('RATE_LIMITED');
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Server responded with ${response.status}: ${text}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout sending batch to WIMS');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// ChatGPT Import
// ---------------------------------------------------------------------------

interface ChatGPTConversationListItem {
  id: string;
  title: string;
  create_time: number;
}

interface ChatGPTListResponse {
  items: ChatGPTConversationListItem[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Import all ChatGPT conversations from the active tab.
 */
export async function importChatGPT(
  tabId: number,
  serverUrl: string,
  apiKey: string,
  onProgress: ProgressCallback,
): Promise<BulkImportResult> {
  let totalImported = 0;
  let totalSkipped = 0;

  // 1. Get access token
  onProgress({ phase: 'fetching_token', current: 0, total: 0, message: 'Getting ChatGPT access token...' });

  let token: string | null = null;

  // Try reading from __remixContext first
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ctx = (window as any).__remixContext;
          if (ctx?.state?.loaderData?.['root']?.accessToken) {
            return ctx.state.loaderData['root'].accessToken as string;
          }
        } catch {
          // ignore
        }
        return null;
      },
    });
    token = results?.[0]?.result ?? null;
  } catch {
    // scripting may fail if tab is not on chatgpt.com
  }

  // Fallback: fetch /api/auth/session from the content script (shares cookies)
  if (!token) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: async () => {
          try {
            const resp = await fetch('https://chatgpt.com/api/auth/session', {
              credentials: 'include',
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return data.accessToken ?? null;
          } catch {
            return null;
          }
        },
      });
      token = results?.[0]?.result ?? null;
    } catch {
      // ignore
    }
  }

  if (!token) {
    throw new Error('Could not obtain ChatGPT access token. Please make sure you are logged in to ChatGPT and refresh the page.');
  }

  // 2. List all conversations
  onProgress({ phase: 'listing', current: 0, total: 0, message: 'Listing ChatGPT conversations...' });

  const allConversations: ChatGPTConversationListItem[] = [];
  let offset = 0;
  const limit = 100;
  let total = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    checkCancelled();

    const resp = await fetch(`https://chatgpt.com/backend-api/conversations?offset=${offset}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new Error('Session expired, please refresh the ChatGPT page and try again.');
    }
    if (resp.status === 429) {
      throw new Error('Rate limited by ChatGPT. Please wait a few minutes and try again.');
    }
    if (!resp.ok) {
      throw new Error(`Failed to list conversations: HTTP ${resp.status}`);
    }

    const data: ChatGPTListResponse = await resp.json();
    total = data.total;
    allConversations.push(...data.items);

    onProgress({
      phase: 'listing',
      current: allConversations.length,
      total,
      message: `Listed ${allConversations.length} of ${total} conversations...`,
    });

    if (allConversations.length >= total || data.items.length < limit) {
      break;
    }

    offset += limit;
    await throttle();
  }

  if (allConversations.length === 0) {
    onProgress({ phase: 'done', current: 0, total: 0, message: 'No conversations found.' });
    return { imported: 0, skipped: 0 };
  }

  // 3. Fetch each conversation and send messages
  const totalConversations = allConversations.length;
  let batchBuffer: IngestPayload[] = [];

  for (let i = 0; i < totalConversations; i++) {
    checkCancelled();

    const conv = allConversations[i];
    onProgress({
      phase: 'fetching',
      current: i + 1,
      total: totalConversations,
      message: `Fetching conversation ${i + 1}/${totalConversations}: ${conv.title || 'Untitled'}`,
    });

    try {
      const resp = await fetch(`https://chatgpt.com/backend-api/conversation/${conv.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (resp.status === 401 || resp.status === 403) {
        throw new Error('Session expired, please refresh the ChatGPT page and try again.');
      }
      if (resp.status === 429) {
        throw new Error('Rate limited by ChatGPT. Please wait a few minutes and try again.');
      }
      if (!resp.ok) {
        // Skip individual conversation errors
        console.warn(`[WIMS BulkImport] Skipped conversation ${conv.id}: HTTP ${resp.status}`);
        await throttle();
        continue;
      }

      const convData = await resp.json();
      const messages = parseChatGPTConversation(convData, conv);
      batchBuffer.push(...messages);
    } catch (error) {
      if (error instanceof CancelledError) throw error;
      if (error instanceof Error && (error.message.includes('Session expired') || error.message.includes('Rate limited'))) {
        throw error;
      }
      console.warn(`[WIMS BulkImport] Error fetching conversation ${conv.id}:`, error);
      await throttle();
      continue;
    }

    // Send batches to WIMS when buffer >= 100
    while (batchBuffer.length >= 100) {
      checkCancelled();
      const batch = batchBuffer.splice(0, 100);
      onProgress({
        phase: 'sending',
        current: i + 1,
        total: totalConversations,
        message: `Sending batch to WIMS (${totalImported} imported so far)...`,
      });
      const result = await sendBatch(serverUrl, apiKey, batch);
      totalImported += result.imported;
      totalSkipped += result.skipped_duplicates;
    }

    await throttle();
  }

  // Send remaining messages
  while (batchBuffer.length > 0) {
    checkCancelled();
    const batch = batchBuffer.splice(0, 100);
    onProgress({
      phase: 'sending',
      current: totalConversations,
      total: totalConversations,
      message: `Sending final batch to WIMS...`,
    });
    const result = await sendBatch(serverUrl, apiKey, batch);
    totalImported += result.imported;
    totalSkipped += result.skipped_duplicates;
  }

  onProgress({
    phase: 'done',
    current: totalConversations,
    total: totalConversations,
    message: `Done! Imported ${totalImported} messages, skipped ${totalSkipped} duplicates.`,
  });

  return { imported: totalImported, skipped: totalSkipped };
}

/**
 * Parse a single ChatGPT conversation response into flat IngestPayload messages.
 * Mirrors the logic of _parse_chatgpt_export in the Python backend.
 */
function parseChatGPTConversation(
  convData: Record<string, unknown>,
  convMeta: ChatGPTConversationListItem,
): IngestPayload[] {
  const messages: IngestPayload[] = [];
  const mapping = convData.mapping as Record<string, Record<string, unknown>> | undefined;
  if (!mapping || typeof mapping !== 'object') return messages;

  const title = (convData.title as string) || convMeta.title || 'Untitled';
  const convId = convMeta.id;
  const createTime = convMeta.create_time;

  for (const nodeId of Object.keys(mapping)) {
    const node = mapping[nodeId];
    if (!node || typeof node !== 'object') continue;

    const msg = node.message as Record<string, unknown> | undefined;
    if (!msg || typeof msg !== 'object') continue;

    const author = msg.author as Record<string, unknown> | undefined;
    const role = (author && typeof author === 'object' ? author.role : 'user') as string;
    if (role === 'system') continue;

    const contentObj = msg.content as Record<string, unknown> | string | undefined;
    let content = '';
    if (typeof contentObj === 'object' && contentObj !== null) {
      const parts = (contentObj as Record<string, unknown>).parts as unknown[];
      if (Array.isArray(parts)) {
        content = parts
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .join('\n');
      }
    } else if (typeof contentObj === 'string') {
      content = contentObj;
    }

    if (!content || !content.trim()) continue;

    const msgTime = (msg.create_time as number | null) || createTime;
    let timestamp: string;
    if (typeof msgTime === 'number') {
      timestamp = new Date(msgTime * 1000).toISOString();
    } else {
      timestamp = new Date().toISOString();
    }

    messages.push({
      id: (msg.id as string) || undefined,
      conversation_id: convId,
      platform: 'chatgpt',
      title,
      content,
      role: role === 'user' || role === 'human' ? 'user' : 'assistant',
      timestamp,
      url: `https://chatgpt.com/c/${convId}`,
    });
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Claude Import
// ---------------------------------------------------------------------------

/**
 * Import all Claude conversations from the active tab.
 */
export async function importClaude(
  tabId: number,
  serverUrl: string,
  apiKey: string,
  onProgress: ProgressCallback,
): Promise<BulkImportResult> {
  let totalImported = 0;
  let totalSkipped = 0;

  // 1. Get orgId from lastActiveOrg cookie
  onProgress({ phase: 'fetching_token', current: 0, total: 0, message: 'Getting Claude organization ID...' });

  let orgId: string | null = null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const match = document.cookie.match(/lastActiveOrg=([^;]+)/);
        return match ? match[1] : null;
      },
    });
    orgId = results?.[0]?.result ?? null;
  } catch {
    // ignore
  }

  if (!orgId) {
    throw new Error('Could not find Claude organization ID. Please make sure you are logged in to Claude and refresh the page.');
  }

  // 2. List conversations from sidebar
  onProgress({ phase: 'listing', current: 0, total: 0, message: 'Listing Claude conversations from sidebar...' });

  let conversationIds: string[] = [];
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const links = document.querySelectorAll('a[href^="/chat/"]');
        const ids: string[] = [];
        links.forEach(link => {
          const href = link.getAttribute('href');
          if (href) {
            const match = href.match(/\/chat\/([a-f0-9-]+)/);
            if (match && match[1]) {
              ids.push(match[1]);
            }
          }
        });
        // Deduplicate
        return [...new Set(ids)];
      },
    });
    conversationIds = results?.[0]?.result ?? [];
  } catch {
    // ignore
  }

  if (conversationIds.length === 0) {
    // Try alternative: fetch from the API directly using the recent conversations endpoint
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: async (oId: string) => {
          try {
            const resp = await fetch(
              `https://claude.ai/api/organizations/${oId}/chat_conversations?limit=500`,
              { credentials: 'include' },
            );
            if (!resp.ok) return [];
            const data = await resp.json();
            if (Array.isArray(data)) {
              return data.map((c: { uuid?: string; id?: string }) => c.uuid || c.id).filter((x): x is string => !!x);
            }
            return [];
          } catch {
            return [];
          }
        },
        args: [orgId],
      });
      conversationIds = results?.[0]?.result ?? [];
    } catch {
      // ignore
    }
  }

  if (conversationIds.length === 0) {
    throw new Error('No Claude conversations found. Please make sure you are on the Claude chat page with conversations visible in the sidebar.');
  }

  onProgress({
    phase: 'listing',
    current: conversationIds.length,
    total: conversationIds.length,
    message: `Found ${conversationIds.length} Claude conversations.`,
  });

  // 3. Fetch each conversation and send messages
  const totalConversations = conversationIds.length;
  let batchBuffer: IngestPayload[] = [];

  for (let i = 0; i < totalConversations; i++) {
    checkCancelled();

    const convId = conversationIds[i];
    onProgress({
      phase: 'fetching',
      current: i + 1,
      total: totalConversations,
      message: `Fetching conversation ${i + 1}/${totalConversations}...`,
    });

    try {
      // Use content script context (shares cookies with claude.ai)
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: async (oId: string, cId: string) => {
          try {
            const resp = await fetch(
              `https://claude.ai/api/organizations/${oId}/chat_conversations/${cId}?tree=true&rendering_mode=messages&render_all_tools=true`,
              { credentials: 'include' },
            );
            if (resp.status === 401 || resp.status === 403) {
              return { error: 'AUTH_ERROR' };
            }
            if (resp.status === 429) {
              return { error: 'RATE_LIMITED' };
            }
            if (!resp.ok) {
              return { error: `HTTP_${resp.status}` };
            }
            return await resp.json();
          } catch (e) {
            return { error: String(e) };
          }
        },
        args: [orgId, convId],
      });

      const convData = results?.[0]?.result;
      if (!convData) {
        console.warn(`[WIMS BulkImport] No data for Claude conversation ${convId}`);
        await throttle();
        continue;
      }

      if (convData.error) {
        if (convData.error === 'AUTH_ERROR') {
          throw new Error('Session expired, please refresh the Claude page and try again.');
        }
        if (convData.error === 'RATE_LIMITED') {
          throw new Error('Rate limited by Claude. Please wait a few minutes and try again.');
        }
        console.warn(`[WIMS BulkImport] Skipped Claude conversation ${convId}: ${convData.error}`);
        await throttle();
        continue;
      }

      const messages = parseClaudeConversation(convData, convId);
      batchBuffer.push(...messages);
    } catch (error) {
      if (error instanceof CancelledError) throw error;
      if (error instanceof Error && (error.message.includes('Session expired') || error.message.includes('Rate limited'))) {
        throw error;
      }
      console.warn(`[WIMS BulkImport] Error fetching Claude conversation ${convId}:`, error);
      await throttle();
      continue;
    }

    // Send batches to WIMS when buffer >= 100
    while (batchBuffer.length >= 100) {
      checkCancelled();
      const batch = batchBuffer.splice(0, 100);
      onProgress({
        phase: 'sending',
        current: i + 1,
        total: totalConversations,
        message: `Sending batch to WIMS (${totalImported} imported so far)...`,
      });
      const result = await sendBatch(serverUrl, apiKey, batch);
      totalImported += result.imported;
      totalSkipped += result.skipped_duplicates;
    }

    await throttle();
  }

  // Send remaining messages
  while (batchBuffer.length > 0) {
    checkCancelled();
    const batch = batchBuffer.splice(0, 100);
    onProgress({
      phase: 'sending',
      current: totalConversations,
      total: totalConversations,
      message: `Sending final batch to WIMS...`,
    });
    const result = await sendBatch(serverUrl, apiKey, batch);
    totalImported += result.imported;
    totalSkipped += result.skipped_duplicates;
  }

  onProgress({
    phase: 'done',
    current: totalConversations,
    total: totalConversations,
    message: `Done! Imported ${totalImported} messages, skipped ${totalSkipped} duplicates.`,
  });

  return { imported: totalImported, skipped: totalSkipped };
}

/**
 * Parse a single Claude conversation API response into flat IngestPayload messages.
 * Mirrors the logic of _parse_claude_export in the Python backend.
 */
function parseClaudeConversation(
  convData: Record<string, unknown>,
  convId: string,
): IngestPayload[] {
  const messages: IngestPayload[] = [];

  const title = (convData.name as string) || (convData.title as string) || 'Untitled';
  const uuid = (convData.uuid as string) || convId;

  const chatMessages = (convData.chat_messages as Record<string, unknown>[]) ||
    (convData.messages as Record<string, unknown>[]) || [];
  if (!Array.isArray(chatMessages)) return messages;

  for (const msg of chatMessages) {
    if (!msg || typeof msg !== 'object') continue;

    const sender = (msg.sender as string) || (msg.role as string) || 'user';
    if (sender === 'system') continue;

    let content = '';
    if (typeof msg.text === 'string') {
      content = msg.text;
    } else if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      const parts: string[] = [];
      for (const part of msg.content as Array<string | Record<string, unknown>>) {
        if (typeof part === 'string') {
          parts.push(part);
        } else if (typeof part === 'object' && part !== null && part.type === 'text') {
          parts.push((part.text as string) || '');
        }
      }
      content = parts.join('\n');
    }

    if (!content || !content.trim()) continue;

    const tsRaw = msg.created_at ?? msg.timestamp ?? msg.created;
    let timestamp: string;
    if (typeof tsRaw === 'number') {
      timestamp = new Date(tsRaw * 1000).toISOString();
    } else if (typeof tsRaw === 'string') {
      timestamp = tsRaw;
    } else {
      timestamp = new Date().toISOString();
    }

    messages.push({
      id: (msg.uuid as string) || (msg.id as string) || undefined,
      conversation_id: uuid,
      platform: 'claude',
      title,
      content,
      role: sender === 'user' || sender === 'human' ? 'user' : 'assistant',
      timestamp,
      url: `https://claude.ai/chat/${uuid}`,
    });
  }

  return messages;
}
