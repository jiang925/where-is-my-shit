import axios from 'axios';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

// Define types based on backend schema
export interface SearchResult {
  id: string;
  score: number;
  content: string;
  relevance_score?: number;
  quality_score?: number;
  exact_match?: boolean;
  meta: {
    source: string;
    adapter: string;
    created_at: number;
    title?: string;
    url?: string;
    conversation_id?: string;
    [key: string]: unknown;
  };
}

export interface SearchGroup {
  conversation_id: string;
  results: SearchResult[];
}

export interface BackendSearchResponse {
  groups: SearchGroup[];
  count: number;
  secondary_groups: SearchGroup[];
  secondary_count: number;
  total_considered: number;
}

// Frontend friendly response (flattened for now)
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  secondary_results: SearchResult[];
  secondary_total: number;
  has_more: boolean;
  next_offset: number | null;
}

// Create axios instance
// In production (served by FastAPI), relative paths work.
// We default to /api/v1 if no env var is set.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
});

// Add interceptor to include API Key
api.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('wims_api_key');
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

// Add interceptor to handle 401/403
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('wims_api_key');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

/**
 * Parse search operators from a query string.
 * Supported: from:platform, before:YYYY-MM-DD, after:YYYY-MM-DD, has:code
 * Returns the cleaned query and extracted operator values.
 */
export function parseSearchOperators(raw: string): {
  query: string;
  fromPlatform?: string;
  beforeDate?: string;
  afterDate?: string;
  hasCode?: boolean;
} {
  let query = raw;
  let fromPlatform: string | undefined;
  let beforeDate: string | undefined;
  let afterDate: string | undefined;
  let hasCode: boolean | undefined;

  // Extract from:platform
  const fromMatch = query.match(/\bfrom:(\S+)/i);
  if (fromMatch) {
    fromPlatform = fromMatch[1].toLowerCase();
    query = query.replace(fromMatch[0], '').trim();
  }

  // Extract before:YYYY-MM-DD
  const beforeMatch = query.match(/\bbefore:(\d{4}-\d{2}-\d{2})/i);
  if (beforeMatch) {
    beforeDate = beforeMatch[1];
    query = query.replace(beforeMatch[0], '').trim();
  }

  // Extract after:YYYY-MM-DD
  const afterMatch = query.match(/\bafter:(\d{4}-\d{2}-\d{2})/i);
  if (afterMatch) {
    afterDate = afterMatch[1];
    query = query.replace(afterMatch[0], '').trim();
  }

  // Extract has:code
  const hasCodeMatch = query.match(/\bhas:code\b/i);
  if (hasCodeMatch) {
    hasCode = true;
    query = query.replace(hasCodeMatch[0], '').trim();
  }

  return { query, fromPlatform, beforeDate, afterDate, hasCode };
}

export const search = async ({
  query,
  limit = 20,
  offset = 0,
  platforms,
  dateRange,
}: {
  query: string;
  limit?: number;
  offset?: number;
  platforms?: string[];
  dateRange?: string;
}): Promise<SearchResponse> => {
  if (!query.trim()) {
    return {
      results: [],
      total: 0,
      secondary_results: [],
      secondary_total: 0,
      has_more: false,
      next_offset: null
    };
  }

  // Parse search operators from query
  const parsed = parseSearchOperators(query);
  const cleanQuery = parsed.query || query; // Fall back to original if operators consumed everything

  // Merge from: operator with platform filter
  let effectivePlatforms = platforms;
  if (parsed.fromPlatform) {
    effectivePlatforms = [parsed.fromPlatform];
  }

  // The backend expects POST /search with JSON body
  const response = await api.post<BackendSearchResponse>('/search', {
    query: cleanQuery,
    limit,
    offset,
    ...(effectivePlatforms && effectivePlatforms.length > 0 && { platform: effectivePlatforms }),
    ...(dateRange && dateRange !== 'all_time' && { date_range: dateRange }),
    ...(parsed.beforeDate && { before_date: parsed.beforeDate }),
    ...(parsed.afterDate && { after_date: parsed.afterDate }),
    ...(parsed.hasCode && { has_code: true }),
  });

  // Flatten groups into results for the current UI
  const results = response.data.groups.flatMap(g => g.results);

  // Flatten secondary groups (backward compat: default to empty if not present)
  const secondary_results = (response.data.secondary_groups || []).flatMap(g => g.results);

  const total = response.data.count;
  const secondary_total = response.data.secondary_count || 0;
  const next_offset = offset + limit;
  const has_more = next_offset < total;

  return {
    results,
    total: total,
    secondary_results,
    secondary_total,
    has_more: has_more,
    next_offset: has_more ? next_offset : null,
  };
};

export const useSearch = (query: string, platforms: string[] = [], dateRange?: string) => {
  return useInfiniteQuery({
    queryKey: ['search', query, platforms.sort(), dateRange],
    queryFn: async ({ pageParam = 0 }) => {
      return search({ query, offset: pageParam as number, platforms, dateRange });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? lastPage.next_offset : undefined;
    },
    initialPageParam: 0,
    enabled: !!query.trim(), // Only run if query is not empty
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};

// === Browse API Types ===

export interface BrowseItem {
  id: string;
  conversation_id: string;
  timestamp: number; // Unix timestamp
  platform: string;
  title: string;
  content: string;
  url: string;
  role?: string;
  message_count?: number;
  first_user_message?: string;
}

export interface BrowseResponse {
  items: BrowseItem[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export type DateRangeOption = 'today' | 'this_week' | 'this_month' | 'all_time';

export const browse = async ({
  cursor,
  limit = 20,
  dateRange,
  platforms,
}: {
  cursor: string | null;
  limit?: number;
  dateRange?: string;
  platforms?: string[];
}): Promise<BrowseResponse> => {
  const response = await api.post<BrowseResponse>('/browse', {
    cursor,
    limit,
    date_range: dateRange === 'all_time' ? undefined : dateRange,
    platforms: platforms && platforms.length > 0 ? platforms : undefined,
  });
  return response.data;
};

export const useBrowse = (dateRange: string, platforms: string[] = []) => {
  return useInfiniteQuery({
    queryKey: ['browse', dateRange, platforms.sort()],
    queryFn: async ({ pageParam }) => {
      return browse({
        cursor: pageParam as string | null,
        dateRange,
        platforms,
      });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined;
    },
    staleTime: 1000 * 60, // 1 minute cache
  });
};

// === Thread / Conversation API ===

export interface ThreadItem {
  id: string;
  conversation_id: string;
  timestamp: number;
  platform: string;
  title: string;
  content: string;
  url: string;
  role: string;
}

export interface ThreadResponse {
  items: ThreadItem[];
  total: number;
}

export const getConversation = async (conversationId: string): Promise<ThreadResponse> => {
  const response = await api.get<ThreadResponse>(`/thread/${conversationId}`);
  return response.data;
};

export const useConversation = (conversationId: string | null) => {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId!),
    enabled: !!conversationId,
    staleTime: 1000 * 60 * 10, // 10-minute cache
  });
};

// === Stats API ===

export interface ActivityEntry {
  date: string;  // YYYY-MM-DD
  count: number;
}

export interface StatsResponse {
  total_messages: number;
  total_conversations: number;
  by_platform: Record<string, number>;
  conversations_by_platform: Record<string, number>;
  activity: ActivityEntry[];
}

export type StatsGranularity = 'day' | 'week' | 'month';

export const getStats = async (granularity: StatsGranularity = 'day', platforms?: string[]): Promise<StatsResponse> => {
  const params = new URLSearchParams();
  params.set('granularity', granularity);
  if (platforms && platforms.length > 0) {
    params.set('platforms', platforms.join(','));
  }
  const response = await api.get<StatsResponse>(`/stats?${params.toString()}`);
  return response.data;
};

export const useStats = (granularity: StatsGranularity = 'day', platforms: string[] = []) => {
  return useQuery({
    queryKey: ['stats', granularity, platforms.sort()],
    queryFn: () => getStats(granularity, platforms),
    staleTime: 1000 * 60 * 5, // 5 min cache
  });
};

// === Related Conversations API ===

export interface RelatedResponse {
  items: ThreadItem[];
  total: number;
}

export const getRelated = async (conversationId: string): Promise<RelatedResponse> => {
  const response = await api.get<RelatedResponse>(`/related/${conversationId}?limit=5`);
  return response.data;
};

export const useRelated = (conversationId: string | null) => {
  return useQuery({
    queryKey: ['related', conversationId],
    queryFn: () => getRelated(conversationId!),
    enabled: !!conversationId,
    staleTime: 1000 * 60 * 10,
  });
};

// === Terminal API ===

export const openTerminal = async (path: string): Promise<{ opened: string }> => {
  const response = await api.post<{ opened: string }>('/open-terminal', { path });
  return response.data;
};

// === Delete API ===

export const deleteConversation = async (conversationId: string): Promise<{ deleted: number }> => {
  const response = await api.delete<{ deleted: number; conversation_id: string }>(
    `/conversations/${conversationId}`
  );
  return response.data;
};

// === Title Update API ===

export const updateConversationTitle = async (conversationId: string, title: string): Promise<{ title: string }> => {
  const response = await api.patch<{ conversation_id: string; title: string }>(
    `/conversations/${conversationId}/title`,
    { title }
  );
  return response.data;
};

// === Export API ===

export const exportAll = async (platforms?: string[]): Promise<void> => {
  const response = await api.post('/export', {
    platforms: platforms && platforms.length > 0 ? platforms : undefined,
  }, { responseType: 'blob' });

  const blob = new Blob([response.data], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wims-export-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
};
