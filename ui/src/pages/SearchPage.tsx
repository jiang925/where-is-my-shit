import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { ResultCard } from '../components/ResultCard';
import { CompactResultCard } from '../components/CompactResultCard';
import { ConversationPanel } from '../components/ConversationPanel';
import { SourceFilterUI, AVAILABLE_PLATFORMS, type PlatformId } from '../components/SourceFilterUI';
import { PresetButtons } from '../components/PresetButtons';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { useSearch, type DateRangeOption } from '../lib/api';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useBookmarks } from '../hooks/useBookmarks';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useNotes } from '../hooks/useNotes';
import { Loader2, LogOut, ChevronDown, ChevronRight, Star, ArrowUpDown, List, LayoutGrid } from 'lucide-react';

interface SearchPageProps {
  onLogout: () => void;
}

export function SearchPage({ onLogout }: SearchPageProps) {
  // URL state management
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Conversation panel state from URL
  const selectedConversation = searchParams.get('conversation') || null;

  const handleSelectConversation = (conversationId: string, messageId?: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (selectedConversation === conversationId) {
      // Toggle off
      newParams.delete('conversation');
      setMatchedMessageId(null);
    } else {
      newParams.set('conversation', conversationId);
      setMatchedMessageId(messageId || null);
    }
    setSearchParams(newParams);
  };

  const handleClosePanel = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('conversation');
    setSearchParams(newParams);
    setMatchedMessageId(null);
  };

  // Default to all platforms selected
  const allPlatformIds = AVAILABLE_PLATFORMS.map(p => p.id) as PlatformId[];
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(allPlatformIds);

  // Bookmarks
  const bookmarks = useBookmarks();
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);

  // Search history
  const searchHistory = useSearchHistory();

  // Notes
  const notes = useNotes();

  // Sort mode
  const [sortBy, setSortBy] = useState<'relevance' | 'recent'>('relevance');

  // View mode (card vs compact)
  const [viewMode, setViewMode] = useState<'card' | 'compact'>(() => {
    return (localStorage.getItem('wims_view_mode') as 'card' | 'compact') || 'card';
  });

  // Matched message ID for jump-to-match in ConversationPanel
  const [matchedMessageId, setMatchedMessageId] = useState<string | null>(null);

  // Date range from URL params
  const dateRange = (searchParams.get('range') as DateRangeOption) || 'all_time';

  // State for collapsible secondary results
  const [showSecondary, setShowSecondary] = useState(false);

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

  // Search hook with platform filtering
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    error
  } = useSearch(query, selectedPlatforms, dateRange);

  // Collect all results from all pages, optionally filter by bookmarks
  const allResultsRaw = useMemo(
    () => data?.pages.flatMap(p => p.results) || [],
    [data?.pages]
  );
  const allResults = useMemo(() => {
    let filtered = showBookmarkedOnly
      ? allResultsRaw.filter(r => r.meta.conversation_id && bookmarks.isBookmarked(r.meta.conversation_id))
      : allResultsRaw;
    if (sortBy === 'recent') {
      filtered = [...filtered].sort((a, b) => (b.meta.created_at || 0) - (a.meta.created_at || 0));
    }
    return filtered;
  }, [allResultsRaw, showBookmarkedOnly, bookmarks, sortBy]);
  const secondaryResults = data?.pages.flatMap(p => p.secondary_results || []) || [];
  const secondaryCount = data?.pages[0]?.secondary_total || 0;

  // Keyboard navigation
  const { focusedIndex, setCardRef } = useKeyboardNavigation({
    itemCount: allResults.length,
    onSelect: (index) => {
      const result = allResults[index];
      if (result?.meta.conversation_id) {
        handleSelectConversation(result.meta.conversation_id, result.id);
      }
    },
    onEscape: handleClosePanel,
    searchInputRef,
    enabled: !!query,
  });

  // Auto-expand secondary results when no primary results but secondary exist
  useEffect(() => {
    if (!data?.pages || data.pages.length === 0) return;

    const primaryCount = data.pages[0].total;
    const hasSecondary = secondaryCount > 0;

    // Auto-expand if no primary results but secondary results exist
    if (primaryCount === 0 && hasSecondary) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Prev/next navigation for ConversationPanel
  const currentResultIndex = useMemo(() => {
    if (!selectedConversation) return -1;
    return allResults.findIndex(r => r.meta.conversation_id === selectedConversation);
  }, [allResults, selectedConversation]);

  const handleNavigatePrev = useCallback(() => {
    if (currentResultIndex > 0) {
      const prev = allResults[currentResultIndex - 1];
      if (prev?.meta.conversation_id) {
        handleSelectConversation(prev.meta.conversation_id, prev.id);
      }
    }
  }, [currentResultIndex, allResults]);

  const handleNavigateNext = useCallback(() => {
    if (currentResultIndex >= 0 && currentResultIndex < allResults.length - 1) {
      const next = allResults[currentResultIndex + 1];
      if (next?.meta.conversation_id) {
        handleSelectConversation(next.meta.conversation_id, next.id);
      }
    }
  }, [currentResultIndex, allResults]);

  // Handle empty state vs initial state
  const showInitialState = !query;
  const showEmptyState = query && status === 'success' && data?.pages[0].results.length === 0;
  const hasActiveFilter = selectedPlatforms.length > 0;
  const isPanelOpen = !!selectedConversation;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center font-sans text-gray-900 dark:text-gray-100">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm pt-4 pb-4 px-4">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <SearchBar
                inputRef={searchInputRef}
                onSearch={(q) => { setQuery(q); if (q.trim()) searchHistory.add(q); }}
                isLoading={isFetching && !isFetchingNextPage}
                initialValue={initialQuery}
                searchHistory={searchHistory.history}
                onSelectHistory={(q) => { setQuery(q); searchHistory.add(q); }}
                onRemoveHistory={searchHistory.remove}
                onClearHistory={searchHistory.clear}
              />
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer mt-1"
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
                const newParams = new URLSearchParams(searchParams);
                if (platforms.length === 0) {
                  newParams.delete('platforms');
                } else {
                  newParams.set('platforms', platforms.join(','));
                }
                setSearchParams(newParams);
              }}
            />
            {bookmarks.count > 0 && (
              <button
                onClick={() => setShowBookmarkedOnly(!showBookmarkedOnly)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border cursor-pointer ml-2 ${
                  showBookmarkedOnly
                    ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-yellow-300 hover:bg-yellow-50'
                }`}
                aria-label="Filter bookmarked conversations"
                aria-pressed={showBookmarkedOnly}
              >
                <Star className={`h-3 w-3 ${showBookmarkedOnly ? 'fill-yellow-400' : ''}`} />
                Starred ({bookmarks.count})
              </button>
            )}
          </div>

          {/* Date Range Filter */}
          <div className="mt-3">
            <DateRangeFilter />
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

          {/* Error State */}
          {status === 'error' && (
            <div className="text-center p-8 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800 mt-4">
              <p className="font-medium">Something went wrong</p>
              <p className="text-sm mt-1">{(error as Error).message}</p>
            </div>
          )}

          {/* Initial State */}
          {showInitialState && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 mt-20">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 animate-spin-slow text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-lg">Start typing to search your history...</p>
              <p className="text-sm mt-2">Use the filters to narrow by source. Press <kbd className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-xs font-mono">/</kbd> to focus search, <kbd className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-xs font-mono">&uarr;&darr;</kbd> to navigate results.</p>
            </div>
          )}

          {/* Empty State (with filter hint + recent query suggestions) */}
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
              {searchHistory.history.length > 0 && (
                <div className="mt-6 text-center">
                  <p className="text-xs text-gray-400 mb-2">Try a recent search:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {searchHistory.history.slice(0, 5).map((h) => (
                      <button
                        key={h}
                        onClick={() => { setQuery(h); searchHistory.add(h); }}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Result count + sort toggle */}
          {query && allResults.length > 0 && (
            <div className="flex items-center justify-between mb-3 text-xs text-gray-500 dark:text-gray-400">
              <span>
                Found {data?.pages[0]?.total || allResults.length} result{(data?.pages[0]?.total || allResults.length) !== 1 ? 's' : ''}
                {secondaryCount > 0 && ` (+${secondaryCount} less relevant)`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSortBy(sortBy === 'relevance' ? 'recent' : 'relevance')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  aria-label={`Sort by ${sortBy === 'relevance' ? 'most recent' : 'best match'}`}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {sortBy === 'relevance' ? 'Best Match' : 'Most Recent'}
                </button>
                <button
                  onClick={() => {
                    const next = viewMode === 'card' ? 'compact' : 'card';
                    setViewMode(next);
                    localStorage.setItem('wims_view_mode', next);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  aria-label={viewMode === 'card' ? 'Switch to compact view' : 'Switch to card view'}
                  title={viewMode === 'card' ? 'Compact view' : 'Card view'}
                >
                  {viewMode === 'card' ? <List className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />}
                </button>
              </div>
            </div>
          )}

          {/* Results Grid */}
          <div className={viewMode === 'compact' ? 'space-y-1' : 'space-y-4'}>
            {allResults.map((result, idx) =>
              viewMode === 'compact' ? (
                <CompactResultCard
                  key={result.id}
                  result={result}
                  onSelect={handleSelectConversation}
                  isSelected={result.meta.conversation_id === selectedConversation}
                  isFocused={idx === focusedIndex}
                  cardRef={(el) => setCardRef(idx, el)}
                />
              ) : (
                <ResultCard
                  key={result.id}
                  result={result}
                  onSelect={handleSelectConversation}
                  isSelected={result.meta.conversation_id === selectedConversation}
                  isFocused={idx === focusedIndex}
                  highlightQuery={query}
                  cardRef={(el) => setCardRef(idx, el)}
                  isBookmarked={!!result.meta.conversation_id && bookmarks.isBookmarked(result.meta.conversation_id)}
                  onToggleBookmark={bookmarks.toggle}
                />
              )
            )}
          </div>

          {/* Collapsible Secondary Results Section */}
          {secondaryResults.length > 0 && (
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <button
                onClick={() => setShowSecondary(!showSecondary)}
                className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
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
                    <ResultCard
                      key={result.id}
                      result={result}
                      className="opacity-80"
                      onSelect={handleSelectConversation}
                      isSelected={result.meta.conversation_id === selectedConversation}
                      highlightQuery={query}
                      isBookmarked={!!result.meta.conversation_id && bookmarks.isBookmarked(result.meta.conversation_id)}
                      onToggleBookmark={bookmarks.toggle}
                    />
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
                  matchedMessageId={matchedMessageId}
                  onNavigatePrev={currentResultIndex > 0 ? handleNavigatePrev : undefined}
                  onNavigateNext={currentResultIndex < allResults.length - 1 ? handleNavigateNext : undefined}
                  note={notes.getNote(selectedConversation)}
                  onNoteChange={notes.setNote}
                />
              </div>
            </div>

            {/* Mobile overlay */}
            <div className="lg:hidden fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={handleClosePanel}
              />
              <div className="absolute right-0 top-0 bottom-0 w-full max-w-[480px] bg-white shadow-xl transition-all duration-300">
                <ConversationPanel
                  conversationId={selectedConversation}
                  onClose={handleClosePanel}
                  isBookmarked={bookmarks.isBookmarked(selectedConversation)}
                  onToggleBookmark={bookmarks.toggle}
                  matchedMessageId={matchedMessageId}
                  onNavigatePrev={currentResultIndex > 0 ? handleNavigatePrev : undefined}
                  onNavigateNext={currentResultIndex < allResults.length - 1 ? handleNavigateNext : undefined}
                  note={notes.getNote(selectedConversation)}
                  onNoteChange={notes.setNote}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
