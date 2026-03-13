import { useState } from 'react';
import { ExternalLink, MessageSquare, Terminal, FileCode, ChevronDown, ChevronUp, Star } from 'lucide-react';
import type { SearchResult } from '../lib/api';
import { cn } from '../lib/utils';
import { CopyablePath } from './CopyablePath';
import { isFilePath } from '../utils/pathUtils';

interface ResultCardProps {
  result: SearchResult;
  className?: string;
  hideScore?: boolean;
  onSelect?: (conversationId: string) => void;
  isSelected?: boolean;
  isFocused?: boolean;
  highlightQuery?: string;
  cardRef?: (el: HTMLDivElement | null) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (conversationId: string) => void;
}

// Platform configuration matching SourceFilterUI for consistency
const PLATFORM_CONFIG: Record<string, {
  icon: React.ElementType;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  chatgpt: {
    icon: MessageSquare,
    label: 'ChatGPT',
    colorClass: 'text-green-700',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
  },
  claude: {
    icon: MessageSquare,
    label: 'Claude',
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  'claude-code': {
    icon: Terminal,
    label: 'Claude Code',
    colorClass: 'text-orange-700',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200',
  },
  gemini: {
    icon: MessageSquare,
    label: 'Gemini',
    colorClass: 'text-blue-700',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
  },
  perplexity: {
    icon: MessageSquare,
    label: 'Perplexity',
    colorClass: 'text-teal-700',
    bgClass: 'bg-teal-50',
    borderClass: 'border-teal-200',
  },
  cursor: {
    icon: FileCode,
    label: 'Cursor',
    colorClass: 'text-purple-700',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
  },
};

// Helper for relative time
function timeAgo(timestamp: number) {
  if (!timestamp) return '';
  const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp;

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = (ms - Date.now()) / 1000;

  if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), 'second');
  if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (Math.abs(diff) < 2592000) return rtf.format(Math.round(diff / 86400), 'day');
  return rtf.format(Math.round(diff / 2592000), 'month');
}

// Get platform config for a source string
function getPlatformConfig(source?: string) {
  if (!source) return null;

  // Direct lookup by platform ID
  const config = PLATFORM_CONFIG[source.toLowerCase()];
  if (config) return config;

  // Fallback for unknown platforms
  return {
    icon: MessageSquare,
    label: source,
    colorClass: 'text-gray-700',
    bgClass: 'bg-gray-50',
    borderClass: 'border-gray-200',
  };
}

/**
 * Highlight matching query terms in text.
 * Splits on word boundaries and wraps matches in <mark>.
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  // Escape regex special chars, split query into words
  const words = query.trim().split(/\s+/).filter(Boolean);
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    pattern.test(part)
      ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{part}</mark>
      : part
  );
}

export function ResultCard({ result, className, hideScore, onSelect, isSelected, isFocused, highlightQuery, cardRef, isBookmarked, onToggleBookmark }: ResultCardProps) {
  const { content, meta } = result;
  const platform = getPlatformConfig(meta.source);
  const Icon = platform?.icon || MessageSquare;

  const title = meta.title || meta.url || 'Untitled Conversation';
  const messageCount = (meta.message_count as number) || 0;
  const firstUserMessage = (meta.first_user_message as string) || '';

  const [expanded, setExpanded] = useState(false);

  const handleClick = () => {
    if (onSelect && meta.conversation_id) {
      onSelect(meta.conversation_id);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "group flex flex-col bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm transition-all",
        onSelect ? "cursor-pointer hover:shadow-md" : "hover:shadow-md",
        isSelected
          ? "border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800 border-l-4 border-l-blue-500"
          : isFocused
            ? "border-blue-300 ring-2 ring-blue-100 dark:ring-blue-800 shadow-md"
            : "border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700",
        className
      )}
      onClick={handleClick}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
    >
      <div className="flex items-center justify-between mb-2 text-xs">
        <div className="flex items-center gap-2">
          {/* Source badge with icon and color */}
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium",
            platform?.bgClass,
            platform?.borderClass,
            platform?.colorClass
          )}>
            <Icon className="h-3.5 w-3.5" />
            <span>{platform?.label || meta.source || 'Unknown'}</span>
          </div>

          <span className="text-gray-500">•</span>

          <time
            dateTime={new Date(meta.created_at * 1000).toISOString()}
            className="text-gray-500"
          >
            {timeAgo(meta.created_at)}
          </time>

          {/* Adapter/Platform additional info */}
          {meta.adapter && meta.adapter !== meta.source && (
            <>
              <span className="text-gray-500">•</span>
              <span className="text-gray-500 capitalize">{meta.adapter}</span>
            </>
          )}
        </div>

        {!hideScore && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 flex items-center gap-2">
            <span>
              {result.relevance_score
                ? `${(result.relevance_score * 100).toFixed(0)}%`
                : `Score: ${result.score.toFixed(2)}`}
            </span>
            {result.exact_match && (
              <span className="px-1.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded">
                Exact
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          {onToggleBookmark && meta.conversation_id && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleBookmark(meta.conversation_id!); }}
              className="flex-shrink-0 p-0.5 transition-colors cursor-pointer"
              aria-label={isBookmarked ? "Remove bookmark" : "Bookmark conversation"}
            >
              <Star className={cn("h-4 w-4", isBookmarked ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-400")} />
            </button>
          )}
          <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate" title={title}>
            {title}
          </h3>
          {messageCount > 1 && (
            <span className="flex-shrink-0 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 px-1.5 py-0.5 rounded">
              {messageCount} msgs
            </span>
          )}
        </div>
        {firstUserMessage && (
          <p className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 p-2 rounded mb-1 line-clamp-2 break-words">
            {firstUserMessage}
          </p>
        )}
        <p className={cn(
          "text-sm text-gray-600 dark:text-gray-300 font-mono bg-gray-50 dark:bg-gray-700/50 p-2 rounded break-words whitespace-pre-wrap",
          !expanded && "line-clamp-3"
        )}>
          {highlightQuery ? highlightText(content, highlightQuery) : content}
        </p>
        {content.length > 200 && (
          <button
            onClick={handleToggleExpand}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-1 transition-colors cursor-pointer"
            aria-label={expanded ? "Collapse preview" : "Expand preview"}
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3" /> Show less</>
            ) : (
              <><ChevronDown className="h-3 w-3" /> Show more</>
            )}
          </button>
        )}
      </div>

      <div className="mt-auto pt-2 flex justify-between items-center">
        {/* Conversation ID for reference */}
        {meta.conversation_id && (
          <span className="text-xs text-gray-400 font-mono">
            ID: {meta.conversation_id.slice(0, 8)}...
          </span>
        )}

        {meta.url && (
          isFilePath(meta.url) ? (
            <span onClick={(e) => e.stopPropagation()}>
              <CopyablePath path={meta.url} />
            </span>
          ) : (
            <a
              href={meta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100"
              onClick={(e) => e.stopPropagation()}
            >
              Open
              <ExternalLink className="h-3 w-3" />
            </a>
          )
        )}
      </div>
    </div>
  );
}
