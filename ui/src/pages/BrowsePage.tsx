import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SourceFilterUI, AVAILABLE_PLATFORMS, type PlatformId } from '../components/SourceFilterUI';
import { PresetButtons } from '../components/PresetButtons';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { TimelineSection } from '../components/TimelineSection';
import { ConversationPanel } from '../components/ConversationPanel';
import { useBrowse, exportAll, type DateRangeOption } from '../lib/api';
import { flattenAndGroup, TIMELINE_SECTIONS, totalGroupedItems, sectionsForDateRange } from '../lib/dateGroups';
import { useBookmarks } from '../hooks/useBookmarks';
import { Loader2, LogOut, Download } from 'lucide-react';

interface BrowsePageProps {
  onLogout: () => void;
}

export function BrowsePage({ onLogout }: BrowsePageProps) {
  // URL state management
  const [searchParams, setSearchParams] = useSearchParams();
  const allPlatformIds = AVAILABLE_PLATFORMS.map(p => p.id) as PlatformId[];
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(allPlatformIds);

  // Bookmarks
  const bookmarks = useBookmarks();

  // Conversation panel state from URL
  const selectedConversation = searchParams.get('conversation') || null;

  const handleSelectConversation = (conversationId: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (selectedConversation === conversationId) {
      // Toggle off
      newParams.delete('conversation');
    } else {
      newParams.set('conversation', conversationId);
    }
    setSearchParams(newParams);
  };

  const handleClosePanel = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('conversation');
    setSearchParams(newParams);
  };

  // Get platforms from URL on mount, sync to state
  useEffect(() => {
    const platformsFromUrl = searchParams.get('platforms');
    if (platformsFromUrl) {
      const platforms = platformsFromUrl.split(',').filter((p): p is PlatformId =>
        AVAILABLE_PLATFORMS.some(ap => ap.id === p)
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const newParams = new URLSearchParams(searchParams);
    if (newPlatforms.length === 0) {
      newParams.delete('platforms');
    } else {
      newParams.set('platforms', newPlatforms.join(','));
    }
    setSearchParams(newParams);
  };

  // Clear all platform filters
  const handleClearFilters = () => {
    setSelectedPlatforms([]);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('platforms');
    setSearchParams(newParams);
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

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      await exportAll(selectedPlatforms);
    } finally {
      setIsExporting(false);
    }
  };

  // Empty state detection
  const showEmptyState = status === 'success' && totalGroupedItems(groupedData) === 0;
  const isPanelOpen = !!selectedConversation;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center font-sans text-gray-900 dark:text-gray-100">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm pt-4 pb-4 px-4">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-start gap-4">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex-1">
              Browse History
            </h1>
            <div className="flex items-center gap-1">
              <button
                onClick={handleExportAll}
                disabled={isExporting}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="Export all conversations as markdown zip"
                aria-label="Export all conversations"
              >
                {isExporting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={onLogout}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                title="Disconnect / Change API Key"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
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
                const newParams = new URLSearchParams(searchParams);
                if (platforms.length === 0) {
                  newParams.delete('platforms');
                } else {
                  newParams.set('platforms', platforms.join(','));
                }
                setSearchParams(newParams);
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content with optional panel */}
      <div className={
        isPanelOpen
          ? "w-full flex-1 flex flex-col lg:flex-row"
          : "w-full flex-1 flex flex-col items-center"
      }>
        {/* Results area */}
        <main className={
          isPanelOpen
            ? "flex-1 overflow-y-auto px-4 py-6 flex flex-col"
            : "w-full max-w-3xl px-4 py-6 flex-1 flex flex-col"
        }>

          {/* Loading State */}
          {status === 'pending' && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 mt-20">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-lg">Loading conversations...</p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="text-center p-8 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800 mt-4">
              <p className="font-medium">Something went wrong</p>
              <p className="text-sm mt-1">{(error as Error).message}</p>
            </div>
          )}

          {/* Empty State */}
          {showEmptyState && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 mt-20">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-lg font-medium">No conversations yet</p>
              <p className="text-sm mt-2 max-w-md text-center text-gray-400 dark:text-gray-500">
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
                  onSelect={handleSelectConversation}
                  selectedConversation={selectedConversation}
                  isBookmarked={bookmarks.isBookmarked}
                  onToggleBookmark={bookmarks.toggle}
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

        {/* Conversation Panel - Desktop (lg+) */}
        {isPanelOpen && selectedConversation && (
          <>
            {/* Desktop panel */}
            <div className="hidden lg:flex w-[480px] flex-shrink-0 border-l border-gray-200 dark:border-gray-700 h-[calc(100vh-4rem)] sticky top-16">
              <div className="w-full transition-all duration-300">
                <ConversationPanel
                  conversationId={selectedConversation}
                  onClose={handleClosePanel}
                  isBookmarked={bookmarks.isBookmarked(selectedConversation)}
                  onToggleBookmark={bookmarks.toggle}
                />
              </div>
            </div>

            {/* Mobile overlay */}
            <div className="lg:hidden fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={handleClosePanel}
              />
              <div className="absolute right-0 top-0 bottom-0 w-full max-w-[480px] bg-white dark:bg-gray-800 shadow-xl transition-all duration-300">
                <ConversationPanel
                  conversationId={selectedConversation}
                  onClose={handleClosePanel}
                  isBookmarked={bookmarks.isBookmarked(selectedConversation)}
                  onToggleBookmark={bookmarks.toggle}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
