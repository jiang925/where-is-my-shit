/**
 * Bulk import module for pulling entire chat history from ChatGPT or Claude.
 *
 * Runs in the service-worker context. ALL platform API calls are executed
 * inside the tab context via chrome.scripting.executeScript so they share
 * the user's session cookies and avoid CORS/origin issues.
 *
 * Import progress is persisted per-conversation in chrome.storage.local so
 * that imports survive failures, cancellations, and browser restarts. Running
 * import again simply skips already-completed conversations.
 */

import { IngestPayload } from '../types/message';

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
  alreadyDone: number;
}

// ---------------------------------------------------------------------------
// Persistent import state
// ---------------------------------------------------------------------------

const IMPORT_STATE_KEY = 'wims_import_done';

interface ImportState {
  chatgpt: string[];  // completed conversation IDs
  claude: string[];
}

async function getImportState(): Promise<ImportState> {
  const result = await chrome.storage.local.get(IMPORT_STATE_KEY);
  return result[IMPORT_STATE_KEY] ?? { chatgpt: [], claude: [] };
}

async function markConversationDone(platform: 'chatgpt' | 'claude', convId: string): Promise<void> {
  const state = await getImportState();
  const list = state[platform];
  if (!list.includes(convId)) {
    list.push(convId);
    await chrome.storage.local.set({ [IMPORT_STATE_KEY]: state });
  }
}

/** Get count of completed conversations for a platform. */
export async function getImportedCount(platform: 'chatgpt' | 'claude'): Promise<number> {
  const state = await getImportState();
  return state[platform].length;
}

/** Reset import state for a platform (for "start fresh" scenario). */
export async function resetImportState(platform: 'chatgpt' | 'claude'): Promise<void> {
  const state = await getImportState();
  state[platform] = [];
  await chrome.storage.local.set({ [IMPORT_STATE_KEY]: state });
}

// ---------------------------------------------------------------------------
// Cancellation & helpers
// ---------------------------------------------------------------------------

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

/** Throttle helper: wait 600-1000ms jitter. */
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
      throw new Error('WIMS server rejected the API key. Check extension settings.');
    }
    if (response.status === 429) {
      throw new Error('WIMS server rate limited. Try again later.');
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`WIMS server error ${response.status}: ${text}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout sending batch to WIMS', { cause: error });
    }
    throw error;
  }
}

/**
 * Flush a batch buffer: send all messages for a single conversation to WIMS,
 * then mark that conversation done in persistent state.
 */
async function flushConversation(
  serverUrl: string,
  apiKey: string,
  platform: 'chatgpt' | 'claude',
  convId: string,
  messages: IngestPayload[],
): Promise<{ imported: number; skipped: number }> {
  let totalImported = 0;
  let totalSkipped = 0;

  // Send in chunks of 100
  for (let i = 0; i < messages.length; i += 100) {
    checkCancelled();
    const batch = messages.slice(i, i + 100);
    const result = await sendBatch(serverUrl, apiKey, batch);
    totalImported += result.imported;
    totalSkipped += result.skipped_duplicates;
  }

  // Only mark done after ALL messages for this conversation are sent
  await markConversationDone(platform, convId);

  return { imported: totalImported, skipped: totalSkipped };
}

// ---------------------------------------------------------------------------
// ChatGPT Import
// ---------------------------------------------------------------------------

interface ChatGPTConversationListItem {
  id: string;
  title: string;
  create_time: number;
}

async function fetchChatGPTToken(tabId: number): Promise<string> {
  // Try /api/auth/session first
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
    const token = results?.[0]?.result ?? null;
    if (token) return token;
  } catch {
    // ignore
  }

  // Fallback: __remixContext
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
    const token = results?.[0]?.result ?? null;
    if (token) return token;
  } catch {
    // ignore
  }

  throw new Error('Could not obtain ChatGPT access token. Make sure you are logged in and refresh the page.');
}

interface FetchResult {
  ok: boolean;
  data?: unknown;
  status?: number;
  error?: string;
}

async function chatgptFetchInTab(
  tabId: number,
  url: string,
  tokenRef: { value: string },
): Promise<FetchResult> {
  const doFetch = async (token: string): Promise<FetchResult> => {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (fetchUrl: string, bearerToken: string) => {
        try {
          const resp = await fetch(fetchUrl, {
            headers: {
              'Authorization': `Bearer ${bearerToken}`,
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });
          if (!resp.ok) {
            return { ok: false, status: resp.status, error: `HTTP ${resp.status}` };
          }
          const data = await resp.json();
          return { ok: true, data };
        } catch (e) {
          return { ok: false, status: 0, error: String(e) };
        }
      },
      args: [url, token],
    });
    return results?.[0]?.result ?? { ok: false, status: 0, error: 'No result from executeScript' };
  };

  let result = await doFetch(tokenRef.value);

  // Auto-refresh token on 401/403
  if (!result.ok && (result.status === 401 || result.status === 403)) {
    console.log('[WIMS BulkImport] ChatGPT token expired, refreshing...');
    try {
      tokenRef.value = await fetchChatGPTToken(tabId);
      result = await doFetch(tokenRef.value);
    } catch {
      // Token refresh failed
    }
  }

  return result;
}

/**
 * Import all ChatGPT conversations. Resumable — skips already-imported ones.
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
  const tokenRef = { value: await fetchChatGPTToken(tabId) };

  // 2. Load persistent state of already-imported conversations
  const doneState = await getImportState();
  const doneSet = new Set(doneState.chatgpt);

  // 3. List all conversations (paginated)
  onProgress({ phase: 'listing', current: 0, total: 0, message: 'Listing ChatGPT conversations...' });

  const allConversations: ChatGPTConversationListItem[] = [];
  let offset = 0;
  const limit = 100;
  let total: number;

  while (true) {
    checkCancelled();

    const result = await chatgptFetchInTab(
      tabId,
      `https://chatgpt.com/backend-api/conversations?offset=${offset}&limit=${limit}`,
      tokenRef,
    );

    if (!result.ok) {
      if (result.status === 429) {
        throw new Error('Rate limited by ChatGPT. Please wait a few minutes and try again.');
      }
      if (result.status === 401 || result.status === 403) {
        throw new Error('ChatGPT session expired. Please refresh the page and try again.');
      }
      throw new Error(`Failed to list conversations: ${result.error}`);
    }

    const data = result.data as { items: ChatGPTConversationListItem[]; total: number; limit: number };
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

  // 4. Filter out already-done conversations
  const remaining = allConversations.filter(c => !doneSet.has(c.id));
  const alreadyDone = allConversations.length - remaining.length;

  if (remaining.length === 0) {
    onProgress({
      phase: 'done',
      current: allConversations.length,
      total: allConversations.length,
      message: `All ${allConversations.length} conversations already imported.`,
    });
    return { imported: 0, skipped: 0, alreadyDone };
  }

  onProgress({
    phase: 'fetching',
    current: 0,
    total: remaining.length,
    message: `${remaining.length} conversations to import (${alreadyDone} already done)...`,
  });

  // 5. Fetch each remaining conversation, send to WIMS, mark done
  for (let i = 0; i < remaining.length; i++) {
    checkCancelled();

    const conv = remaining[i];
    onProgress({
      phase: 'fetching',
      current: i + 1,
      total: remaining.length,
      message: `Fetching ${i + 1}/${remaining.length}: ${conv.title || 'Untitled'}`,
    });

    try {
      const result = await chatgptFetchInTab(
        tabId,
        `https://chatgpt.com/backend-api/conversation/${conv.id}`,
        tokenRef,
      );

      if (!result.ok) {
        if (result.status === 429) {
          throw new Error('Rate limited by ChatGPT. Please wait a few minutes and try again.');
        }
        if (result.status === 401 || result.status === 403) {
          throw new Error('ChatGPT session expired. Please refresh the page and try again.');
        }
        console.warn(`[WIMS BulkImport] Skipped conversation ${conv.id}: ${result.error}`);
        await throttle();
        continue;
      }

      const convData = result.data as Record<string, unknown>;
      const messages = parseChatGPTConversation(convData, conv);

      if (messages.length > 0) {
        onProgress({
          phase: 'sending',
          current: i + 1,
          total: remaining.length,
          message: `Sending ${messages.length} messages from "${conv.title || 'Untitled'}" to WIMS...`,
        });

        const flushResult = await flushConversation(serverUrl, apiKey, 'chatgpt', conv.id, messages);
        totalImported += flushResult.imported;
        totalSkipped += flushResult.skipped;
      } else {
        // No messages to send, but mark done so we don't re-fetch
        await markConversationDone('chatgpt', conv.id);
      }
    } catch (error) {
      if (error instanceof CancelledError) throw error;
      if (error instanceof Error && (error.message.includes('session expired') || error.message.includes('Rate limited') || error.message.includes('WIMS server'))) {
        throw error;
      }
      console.warn(`[WIMS BulkImport] Error fetching conversation ${conv.id}:`, error);
      await throttle();
      continue;
    }

    await throttle();
  }

  const doneNow = alreadyDone + remaining.length;
  onProgress({
    phase: 'done',
    current: doneNow,
    total: allConversations.length,
    message: `Done! Imported ${totalImported} messages, ${totalSkipped} duplicates, ${alreadyDone} already done.`,
  });

  return { imported: totalImported, skipped: totalSkipped, alreadyDone };
}

/**
 * Parse a single ChatGPT conversation response into flat IngestPayload messages.
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
 * Import all Claude conversations. Resumable — skips already-imported ones.
 */
export async function importClaude(
  tabId: number,
  serverUrl: string,
  apiKey: string,
  onProgress: ProgressCallback,
): Promise<BulkImportResult> {
  let totalImported = 0;
  let totalSkipped = 0;

  // 1. Get orgId
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
    throw new Error('Could not find Claude organization ID. Make sure you are logged in and refresh the page.');
  }

  // 2. Load persistent state
  const doneState = await getImportState();
  const doneSet = new Set(doneState.claude);

  // 3. List conversations via API
  onProgress({ phase: 'listing', current: 0, total: 0, message: 'Listing Claude conversations...' });

  let conversationIds: string[] = [];

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (oId: string) => {
        try {
          const resp = await fetch(
            `https://claude.ai/api/organizations/${oId}/chat_conversations?limit=500`,
            { credentials: 'include' },
          );
          if (!resp.ok) return { ids: [], error: `HTTP ${resp.status}` };
          const data = await resp.json();
          if (Array.isArray(data)) {
            return {
              ids: data.map((c: { uuid?: string; id?: string }) => c.uuid || c.id).filter((x): x is string => !!x),
            };
          }
          return { ids: [] };
        } catch (e) {
          return { ids: [], error: String(e) };
        }
      },
      args: [orgId],
    });
    const result = results?.[0]?.result;
    conversationIds = result?.ids ?? [];
  } catch {
    // ignore
  }

  // Fallback: scrape sidebar
  if (conversationIds.length === 0) {
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
          return [...new Set(ids)];
        },
      });
      conversationIds = results?.[0]?.result ?? [];
    } catch {
      // ignore
    }
  }

  if (conversationIds.length === 0) {
    throw new Error('No Claude conversations found. Make sure you are on the Claude chat page.');
  }

  // 4. Filter out already-done
  const remaining = conversationIds.filter(id => !doneSet.has(id));
  const alreadyDone = conversationIds.length - remaining.length;

  if (remaining.length === 0) {
    onProgress({
      phase: 'done',
      current: conversationIds.length,
      total: conversationIds.length,
      message: `All ${conversationIds.length} conversations already imported.`,
    });
    return { imported: 0, skipped: 0, alreadyDone };
  }

  onProgress({
    phase: 'fetching',
    current: 0,
    total: remaining.length,
    message: `${remaining.length} conversations to import (${alreadyDone} already done)...`,
  });

  // 5. Fetch each remaining conversation, send to WIMS, mark done
  for (let i = 0; i < remaining.length; i++) {
    checkCancelled();

    const convId = remaining[i];
    onProgress({
      phase: 'fetching',
      current: i + 1,
      total: remaining.length,
      message: `Fetching conversation ${i + 1}/${remaining.length}...`,
    });

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: async (oId: string, cId: string) => {
          try {
            const resp = await fetch(
              `https://claude.ai/api/organizations/${oId}/chat_conversations/${cId}?tree=true&rendering_mode=messages&render_all_tools=true`,
              { credentials: 'include' },
            );
            if (!resp.ok) {
              return { error: `HTTP_${resp.status}`, status: resp.status };
            }
            return { data: await resp.json() };
          } catch (e) {
            return { error: String(e), status: 0 };
          }
        },
        args: [orgId, convId],
      });

      const convResult = results?.[0]?.result;
      if (!convResult || convResult.error) {
        const status = convResult?.status ?? 0;
        if (status === 401 || status === 403) {
          throw new Error('Claude session expired. Please refresh the page and try again.');
        }
        if (status === 429) {
          throw new Error('Rate limited by Claude. Please wait a few minutes and try again.');
        }
        console.warn(`[WIMS BulkImport] Skipped Claude conversation ${convId}: ${convResult?.error}`);
        await throttle();
        continue;
      }

      const messages = parseClaudeConversation(convResult.data as Record<string, unknown>, convId);

      if (messages.length > 0) {
        onProgress({
          phase: 'sending',
          current: i + 1,
          total: remaining.length,
          message: `Sending ${messages.length} messages to WIMS...`,
        });

        const flushResult = await flushConversation(serverUrl, apiKey, 'claude', convId, messages);
        totalImported += flushResult.imported;
        totalSkipped += flushResult.skipped;
      } else {
        await markConversationDone('claude', convId);
      }
    } catch (error) {
      if (error instanceof CancelledError) throw error;
      if (error instanceof Error && (error.message.includes('session expired') || error.message.includes('Rate limited') || error.message.includes('WIMS server'))) {
        throw error;
      }
      console.warn(`[WIMS BulkImport] Error fetching Claude conversation ${convId}:`, error);
      await throttle();
      continue;
    }

    await throttle();
  }

  const doneNow = alreadyDone + remaining.length;
  onProgress({
    phase: 'done',
    current: doneNow,
    total: conversationIds.length,
    message: `Done! Imported ${totalImported} messages, ${totalSkipped} duplicates, ${alreadyDone} already done.`,
  });

  return { imported: totalImported, skipped: totalSkipped, alreadyDone };
}

/**
 * Parse a single Claude conversation API response into flat IngestPayload messages.
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
