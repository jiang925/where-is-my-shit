import axios from 'axios';
import { useInfiniteQuery } from '@tanstack/react-query';

// Define types based on backend schema
export interface SearchResult {
  id: string;
  score: number;
  content: string;
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
}

// Frontend friendly response (flattened for now)
export interface SearchResponse {
  results: SearchResult[];
  total: number;
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

export const search = async ({
  query,
  limit = 20,
  offset = 0,
  platforms
}: {
  query: string;
  limit?: number;
  offset?: number;
  platforms?: string[];
}): Promise<SearchResponse> => {
  if (!query.trim()) {
    return { results: [], total: 0, has_more: false, next_offset: null };
  }

  // The backend expects POST /search with JSON body
  const response = await api.post<BackendSearchResponse>('/search', {
    query,
    limit,
    offset,
    ...(platforms && platforms.length > 0 && { platform: platforms }),
  });

  // Flatten groups into results for the current UI
  const results = response.data.groups.flatMap(g => g.results);

  // Backend currently returns 'count' but not has_more/next_offset explicitly in the schema I saw earlier.
  // The schema in src/app/schemas/message.py showed:
  // class SearchResponse(BaseModel):
  //    groups: list[SearchResultGroup]
  //    count: int

  // So we need to calculate has_more manually or check if backend supports it.
  // The backend implementation I read:
  // return SearchResponse(groups=groups, count=total_count)

  // It doesn't return has_more or next_offset.
  // We can infer has_more if results.length >= limit?
  // But since it's grouped, total_count is accurate.

  const total = response.data.count;
  const next_offset = offset + limit;
  const has_more = next_offset < total;

  return {
    results,
    total: total,
    has_more: has_more,
    next_offset: has_more ? next_offset : null,
  };
};

export const useSearch = (query: string, platforms: string[] = []) => {
  return useInfiniteQuery({
    queryKey: ['search', query, platforms.sort() /* sort for consistency */],
    queryFn: async ({ pageParam = 0 }) => {
      return search({ query, offset: pageParam as number });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? lastPage.next_offset : undefined;
    },
    initialPageParam: 0,
    enabled: !!query.trim(), // Only run if query is not empty
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
