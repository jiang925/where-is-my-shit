import type { BrowseItem } from '../lib/api';
import { ResultCard } from './ResultCard';
import type { SearchResult } from '../lib/api';

interface TimelineSectionProps {
  title: string;
  items: BrowseItem[];
  isEmpty: boolean;
}

/**
 * Convert a BrowseItem to a SearchResult for rendering with ResultCard.
 * This adapter lets us reuse the existing ResultCard component per user decision.
 */
function browseItemToSearchResult(item: BrowseItem): SearchResult {
  return {
    id: item.id,
    score: 0, // No relevance score for browse items
    content: item.content,
    meta: {
      source: item.platform,
      adapter: item.platform,
      created_at: item.timestamp,
      title: item.title,
      url: item.url,
      conversation_id: item.conversation_id,
    },
    // Claude's discretion: hide relevance score on browse cards,
    // ResultCard already shows timeAgo which is more useful for timeline
  };
}

export function TimelineSection({ title, items, isEmpty }: TimelineSectionProps) {
  return (
    <section className="mb-6">
      {/* Inline section header (Claude's discretion: inline chosen over sticky
          because sticky headers stack on top of the page header creating visual clutter) */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <span>{title}</span>
        <span className="text-xs font-normal text-gray-400">
          ({items.length})
        </span>
      </h2>

      {isEmpty ? (
        <p className="text-sm text-gray-400 italic py-2 pl-1">
          No conversations
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ResultCard
              key={item.id}
              result={browseItemToSearchResult(item)}
              hideScore
            />
          ))}
        </div>
      )}
    </section>
  );
}
