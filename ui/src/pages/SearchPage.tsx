import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { ResultCard } from '../components/ResultCard';
import { SourceFilterUI, AVAILABLE_PLATFORMS, type PlatformId } from '../components/SourceFilterUI';
import { PresetButtons } from '../components/PresetButtons';
import { useSearch } from '../lib/api';
import { Loader2, LogOut, ChevronDown, ChevronRight } from 'lucide-react';

interface SearchPageProps {
  onLogout: () => void;
}

export function SearchPage({ onLogout }: SearchPageProps) {
  // URL state management
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  // Default to all platforms selected
  const allPlatformIds = AVAILABLE_PLATFORMS.map(p => p.id) as PlatformId[];
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(allPlatformIds);

  // State for collapsible secondary results
  const [showSecondary, setShowSecondary] = useState(false);

  useEffect(() => {
    const platformsFromUrl = searchParams.get('platforms');
    if (platformsFromUrl) {
      const platforms = platformsFromUrl.split(',').filter((p): p is PlatformId =>
        AVAILABLE_PLATFORMS.some(ap => ap.id === p)
      );
      setSelectedPlatforms(platforms);
    }
  }, [searchParams]);

  // Update URL when platforms change
  const handlePlatformToggle = (platform: PlatformId) => {
    const newPlatforms = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter(p => p !== platform)
      : [...selectedPlatforms, platform];

    setSelectedPlatforms(newPlatforms);

    // Update URL
    if (newPlatforms.length === 0) {
      searchParams.delete('platforms');
    } else {
      searchParams.set('platforms', newPlatforms.join(','));
    }
    setSearchParams(searchParams);
  };

  // Clear all platform filters
  const handleClearFilters = () => {
    setSelectedPlatforms([]);
    searchParams.delete('platforms');
    setSearchParams(searchParams);
  };

  // Search hook with platform filtering
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    error
  } = useSearch(query, selectedPlatforms);

  // Collect all secondary results from all pages
  const secondaryResults = data?.pages.flatMap(p => p.secondary_results || []) || [];
  const secondaryCount = data?.pages[0]?.secondary_total || 0;

  // Auto-expand secondary results when no primary results but secondary exist
  useEffect(() => {
    if (!data?.pages || data.pages.length === 0) return;

    const primaryCount = data.pages[0].total;
    const hasSecondary = secondaryCount > 0;

    // Auto-expand if no primary results but secondary results exist
    if (primaryCount === 0 && hasSecondary) {
      setShowSecondary(true);
    } else if (primaryCount > 0) {
      // Reset when primary results appear
      setShowSecondary(false);
    }
  }, [data?.pages, secondaryCount]);

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
  const hasActiveFilter = selectedPlatforms.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center font-sans text-gray-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm pt-4 pb-4 px-4">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <SearchBar
                onSearch={setQuery}
                isLoading={isFetching && !isFetchingNextPage}
              />
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer mt-1"
              title="Disconnect / Change API Key"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Source Filter UI */}
          <div className="mt-4">
            <SourceFilterUI
              selectedPlatforms={selectedPlatforms}
              onPlatformToggle={handlePlatformToggle}
              onClear={handleClearFilters}
            />
          </div>

          {/* Preset Filter Buttons */}
          <div className="mt-3">
            <PresetButtons
              selectedPlatforms={selectedPlatforms}
              onPresetSelect={(platforms) => {
                setSelectedPlatforms(platforms);
                if (platforms.length === 0) {
                  searchParams.delete('platforms');
                } else {
                  searchParams.set('platforms', platforms.join(','));
                }
                setSearchParams(searchParams);
              }}
            />
          </div>
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
            <p className="text-sm mt-2">Use the filter below to narrow results by source.</p>
          </div>
        )}

        {/* Empty State (with filter hint) */}
        {showEmptyState && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 mt-20">
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm mt-1">
              {hasActiveFilter
                ? "Try adjusting your filters or search terms."
                : "Try different keywords or check your spelling."}
            </p>
            {hasActiveFilter && (
              <button
                onClick={handleClearFilters}
                className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer"
              >
                Clear filters
              </button>
            )}
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

        {/* Collapsible Secondary Results Section */}
        {secondaryResults.length > 0 && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <button
              onClick={() => setShowSecondary(!showSecondary)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
              aria-expanded={showSecondary}
              aria-controls="secondary-results"
            >
              {showSecondary ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span>
                Show {secondaryCount} less relevant result{secondaryCount !== 1 ? 's' : ''}
              </span>
            </button>
            {showSecondary && (
              <div id="secondary-results" className="space-y-4 mt-4">
                {secondaryResults.map((result) => (
                  <ResultCard key={result.id} result={result} className="opacity-80" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading Indicator for Infinite Scroll */}
        {(isFetchingNextPage || hasNextPage) && showEmptyState === false && (
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
