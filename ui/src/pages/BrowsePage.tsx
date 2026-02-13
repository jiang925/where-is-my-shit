import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ResultCard } from '../components/ResultCard';
import { SourceFilterUI, AVAILABLE_PLATFORMS, type PlatformId } from '../components/SourceFilterUI';
import { PresetButtons } from '../components/PresetButtons';
import { useSearch } from '../lib/api';
import { Loader2, LogOut } from 'lucide-react';

interface BrowsePageProps {
  onLogout: () => void;
}

export function BrowsePage({ onLogout }: BrowsePageProps) {
  // URL state management
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);

  // Get platforms from URL on mount, sync to state
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

  // Search with empty query to browse all results, filtered by platform
  // Note: Empty query returns empty results per API, so we'll show a helpful state
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useSearch('', selectedPlatforms);

  const hasActiveFilter = selectedPlatforms.length > 0;

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

  // For browse mode, we're browsing without a search query
  // The API returns empty results for empty queries, so we show a helpful message
  const showBrowseState = !hasActiveFilter;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center font-sans text-gray-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm pt-4 pb-4 px-4">
        <div className="max-w-3xl mx-auto w-full">
          <h1 className="text-xl font-semibold text-gray-800 mb-3">
            Browse History
          </h1>

          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                Filter your conversations by source to browse specific platforms.
              </p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
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

        {/* Browse Instructions */}
        {showBrowseState && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 mt-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-lg font-medium">Select sources to browse</p>
            <p className="text-sm mt-2">
              Choose one or more platform filters above to view conversations from those sources.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700 border border-green-300">
                ChatGPT
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 text-orange-700 border border-orange-300">
                Claude Code
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-700 border border-blue-300">
                Gemini
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-700 border border-purple-300">
                Cursor
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && hasActiveFilter && (
          <div className="text-center p-8 text-red-500 bg-red-50 rounded-lg border border-red-100 mt-4">
            <p className="font-medium">Something went wrong</p>
            <p className="text-sm mt-1">{(error as Error).message}</p>
          </div>
        )}

        {/* No results for filters */}
        {hasActiveFilter && status === 'success' && data?.pages[0].results.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 mt-20">
            <p className="text-lg font-medium">No conversations found</p>
            <p className="text-sm mt-1">
              There are no saved conversations from the selected source{selectedPlatforms.length > 1 ? 's' : ''}.
            </p>
            <button
              onClick={handleClearFilters}
              className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Filter Active Indicator */}
        {hasActiveFilter && status === 'success' && data?.pages[0].results.length > 0 && (
          <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              {data?.pages[0].total || 0} conversations found
              <span className="ml-2 text-gray-400">
                ({selectedPlatforms.length} source{selectedPlatforms.length > 1 ? 's' : ''} selected)
              </span>
            </span>
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
        {(isFetchingNextPage || hasNextPage) && hasActiveFilter && (
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
