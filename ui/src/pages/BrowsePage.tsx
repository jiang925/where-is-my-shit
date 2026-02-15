import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SourceFilterUI, AVAILABLE_PLATFORMS, type PlatformId } from '../components/SourceFilterUI';
import { PresetButtons } from '../components/PresetButtons';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { TimelineSection } from '../components/TimelineSection';
import { useBrowse, type DateRangeOption } from '../lib/api';
import { flattenAndGroup, TIMELINE_SECTIONS, totalGroupedItems, sectionsForDateRange } from '../lib/dateGroups';
import { Loader2, LogOut } from 'lucide-react';

interface BrowsePageProps {
  onLogout: () => void;
}

export function BrowsePage({ onLogout }: BrowsePageProps) {
  // URL state management
  const [searchParams, setSearchParams] = useSearchParams();
  const allPlatformIds = AVAILABLE_PLATFORMS.map(p => p.id) as PlatformId[];
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(allPlatformIds);

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

  // Get date range from URL
  const dateRange = (searchParams.get('range') as DateRangeOption) || 'all_time';

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

  // Browse hook with date range and platform filtering
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useBrowse(dateRange, selectedPlatforms);

  // Group items by timeline sections (auto-updates relative dates)
  const groupedData = flattenAndGroup(data?.pages);

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

  // Empty state detection
  const showEmptyState = status === 'success' && totalGroupedItems(groupedData) === 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center font-sans text-gray-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm pt-4 pb-4 px-4">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-start gap-4">
            <h1 className="text-xl font-semibold text-gray-800 flex-1">
              Browse History
            </h1>
            <button
              onClick={onLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Disconnect / Change API Key"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Date Range Filter */}
          <div className="mt-4">
            <DateRangeFilter />
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

        {/* Loading State */}
        {status === 'pending' && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 mt-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300 mb-4" />
            <p className="text-lg">Loading conversations...</p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center p-8 text-red-500 bg-red-50 rounded-lg border border-red-100 mt-4">
            <p className="font-medium">Something went wrong</p>
            <p className="text-sm mt-1">{(error as Error).message}</p>
          </div>
        )}

        {/* Empty State */}
        {showEmptyState && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 mt-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-lg font-medium">No conversations yet</p>
            <p className="text-sm mt-2 max-w-md text-center text-gray-400">
              Install the extension or set up a watcher to start capturing your AI conversations.
            </p>
          </div>
        )}

        {/* Timeline Sections */}
        {status === 'success' && !showEmptyState && (
          <div>
            {TIMELINE_SECTIONS
              .filter(section => sectionsForDateRange(dateRange).includes(section.key))
              .map(section => (
              <TimelineSection
                key={section.key}
                title={section.label}
                items={groupedData[section.key]}
                isEmpty={groupedData[section.key].length === 0}
              />
            ))}
          </div>
        )}

        {/* Loading Indicator for Infinite Scroll */}
        {(isFetchingNextPage || hasNextPage) && !showEmptyState && status === 'success' && (
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
