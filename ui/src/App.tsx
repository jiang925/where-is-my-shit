import { useState, useRef, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchBar } from './components/SearchBar';
import { ResultCard } from './components/ResultCard';
import { useSearch } from './lib/api';
import { Loader2 } from 'lucide-react';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function SearchInterface() {
  const [query, setQuery] = useState('');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    error
  } = useSearch(query);

  // Intersection Observer for infinite scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });

    if (node) observer.current.observe(node);
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  // Handle empty state vs initial state
  const showInitialState = !query;
  const showEmptyState = query && status === 'success' && data?.pages[0].results.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center font-sans text-gray-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm pt-4 pb-4 px-4">
        <div className="max-w-3xl mx-auto w-full">
          <SearchBar
            onSearch={setQuery}
            isLoading={isFetching && !isFetchingNextPage}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full max-w-3xl px-4 py-6 flex-1 flex flex-col">

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center p-8 text-red-500 bg-red-50 rounded-lg border border-red-100 mt-4">
            <p className="font-medium">Something went wrong</p>
            <p className="text-sm mt-1">{(error as Error).message}</p>
          </div>
        )}

        {/* Initial State */}
        {showInitialState && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 mt-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 animate-spin-slow text-gray-300" />
            </div>
            <p className="text-lg">Start typing to search your history...</p>
          </div>
        )}

        {/* Empty State */}
        {showEmptyState && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 mt-20">
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm">Try different keywords or check your spelling.</p>
          </div>
        )}

        {/* Results Grid */}
        <div className="space-y-4">
          {data?.pages.map((page, i) => (
            <div key={i} className="contents">
              {page.results.map((result) => (
                <ResultCard key={result.id} result={result} />
              ))}
            </div>
          ))}
        </div>

        {/* Loading Indicator for Infinite Scroll */}
        {(isFetchingNextPage || hasNextPage) && (
          <div
            ref={lastElementRef}
            className="w-full py-8 flex justify-center items-center text-gray-400"
          >
            {isFetchingNextPage ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <span className="text-sm">Load more</span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SearchInterface />
    </QueryClientProvider>
  );
}

export default App;
