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
    [key: string]: any;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  has_more: boolean;
  next_offset: number | null;
}

// Create axios instance
// In production (served by FastAPI), relative paths work.
// In dev, we might need a proxy or full URL.
// For now, we assume relative path /search works or is proxied.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

export const search = async ({ query, limit = 20, offset = 0 }: { query: string; limit?: number; offset?: number }): Promise<SearchResponse> => {
  if (!query.trim()) {
    return { results: [], total: 0, has_more: false, next_offset: null };
  }

  // The backend expects POST /search with JSON body
  const response = await api.post('/search', {
    query,
    limit,
    offset,
  });

  return response.data;
};

export const useSearch = (query: string) => {
  return useInfiniteQuery({
    queryKey: ['search', query],
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
