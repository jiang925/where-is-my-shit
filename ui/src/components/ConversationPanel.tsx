import { useEffect, useCallback, useState, useMemo } from 'react';
import { X, ExternalLink, Download, Search, Loader2, MessageSquare, Terminal, FileCode, Trash2, Star } from 'lucide-react';
import Markdown from 'react-markdown';
import { useConversation, deleteConversation, openTerminal, type ThreadItem } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import { isFilePath } from '../utils/pathUtils';

interface ConversationPanelProps {
  conversationId: string;
  onClose: () => void;
  onDeleted?: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (conversationId: string) => void;
}

// Platform configuration (mirrors ResultCard for consistency)
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

function getPlatformConfig(source?: string) {
  if (!source) return null;
  const config = PLATFORM_CONFIG[source.toLowerCase()];
  if (config) return config;
  return {
    icon: MessageSquare,
    label: source,
    colorClass: 'text-gray-700',
    bgClass: 'bg-gray-50',
    borderClass: 'border-gray-200',
  };
}

function formatTimestamp(timestamp: number): string {
  const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}

function isUserRole(role: string): boolean {
  const lower = role.toLowerCase();
  return lower === 'user' || lower === 'human';
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
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

function messageMatchesQuery(content: string, query: string): boolean {
  if (!query.trim()) return true;
  const lower = content.toLowerCase();
  return query.trim().split(/\s+/).some(word => lower.includes(word.toLowerCase()));
}

function MessageBubble({ item, searchQuery, isMatch }: { item: ThreadItem; searchQuery?: string; isMatch?: boolean }) {
  const isUser = isUserRole(item.role);
  const dimmed = searchQuery && !isMatch;

  return (
    <div
      className={cn(
        'rounded-lg p-4 border-l-4 transition-opacity',
        isUser
          ? 'bg-blue-50 dark:bg-blue-900/30 border-l-blue-300'
          : 'bg-white dark:bg-gray-800 border-l-gray-300 dark:border-l-gray-600',
        dimmed && 'opacity-30'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          isUser ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
        )}>
          {isUser ? 'You' : 'Assistant'}
        </span>
        <time className="text-xs text-gray-400">
          {formatTimestamp(item.timestamp)}
        </time>
      </div>
      {searchQuery && isMatch ? (
        <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
          {highlightText(item.content, searchQuery)}
        </div>
      ) : (
        <div className="text-sm text-gray-800 dark:text-gray-200 break-words prose prose-sm dark:prose-invert max-w-none prose-pre:bg-gray-100 dark:prose-pre:bg-gray-900 prose-pre:rounded-md prose-pre:p-3 prose-pre:text-xs prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2">
          <Markdown>{item.content}</Markdown>
        </div>
      )}
    </div>
  );
}

function threadToMarkdown(items: ThreadItem[], title: string, platform: string): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`**Platform:** ${platform}`);
  if (items.length > 0) {
    const ms = items[0].timestamp < 1e11 ? items[0].timestamp * 1000 : items[0].timestamp;
    lines.push(`**Date:** ${new Date(ms).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const item of items) {
    const role = isUserRole(item.role) ? 'User' : 'Assistant';
    const ms = item.timestamp < 1e11 ? item.timestamp * 1000 : item.timestamp;
    const time = new Date(ms).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
    lines.push(`## ${role} *(${time})*`);
    lines.push('');
    lines.push(item.content);
    lines.push('');
  }

  return lines.join('\n');
}

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ConversationPanel({ conversationId, onClose, onDeleted, isBookmarked, onToggleBookmark }: ConversationPanelProps) {
  const { data, isLoading, isError, error } = useConversation(conversationId);
  const [threadSearch, setThreadSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  // Reset search when conversation changes
  useEffect(() => {
    setThreadSearch('');
  }, [conversationId]);

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (threadSearch) {
          setThreadSearch('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, threadSearch]);

  // Derive metadata from first item
  const firstItem = data?.items?.[0];
  const platform = getPlatformConfig(firstItem?.platform);
  const PlatformIcon = platform?.icon || MessageSquare;
  const title = firstItem?.title || 'Conversation';
  const url = firstItem?.url;

  // Sort items chronologically (oldest first)
  const sortedItems = data?.items
    ? [...data.items].sort((a, b) => a.timestamp - b.timestamp)
    : [];

  const handleExport = useCallback(() => {
    if (sortedItems.length === 0) return;
    const md = threadToMarkdown(sortedItems, title, platform?.label || 'Unknown');
    const safeName = title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').slice(0, 60);
    downloadMarkdown(md, `${safeName}.md`);
  }, [sortedItems, title, platform?.label]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deleteConversation(conversationId);
      // Invalidate caches so search/browse reflect the deletion
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['browse'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.removeQueries({ queryKey: ['conversation', conversationId] });
      onDeleted?.();
      onClose();
    } catch {
      // Reset state on error
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }, [conversationId, queryClient, onDeleted, onClose]);

  // Compute which messages match the thread search
  const matchCount = useMemo(() => {
    if (!threadSearch.trim()) return sortedItems.length;
    return sortedItems.filter(item => messageMatchesQuery(item.content, threadSearch)).length;
  }, [sortedItems, threadSearch]);

  return (
    <div className="relative flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Platform badge */}
            {platform && (
              <div className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium mb-2',
                platform.bgClass,
                platform.borderClass,
                platform.colorClass
              )}>
                <PlatformIcon className="h-3.5 w-3.5" />
                <span>{platform.label}</span>
              </div>
            )}
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={title}>
              {title}
            </h2>
            {url && (
              url && isFilePath(url) ? (
                <button
                  onClick={() => openTerminal(url)}
                  className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 mt-1 cursor-pointer"
                  aria-label="Open in terminal"
                >
                  <Terminal className="h-3 w-3" />
                  Open in Terminal
                </button>
              ) : (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                >
                  Open original
                  <ExternalLink className="h-3 w-3" />
                </a>
              )
            )}
          </div>
          <div className="flex items-center gap-1">
            {onToggleBookmark && (
              <button
                onClick={() => onToggleBookmark(conversationId)}
                className="flex-shrink-0 p-1.5 rounded-lg transition-colors cursor-pointer"
                aria-label={isBookmarked ? "Remove bookmark" : "Bookmark conversation"}
                title={isBookmarked ? "Remove bookmark" : "Bookmark"}
              >
                <Star className={cn("h-5 w-5", isBookmarked ? "fill-yellow-400 text-yellow-400" : "text-gray-400 hover:text-yellow-400")} />
              </button>
            )}
            {sortedItems.length > 0 && (
              <>
                <button
                  onClick={handleExport}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                  aria-label="Export as markdown"
                  title="Export as markdown"
                >
                  <Download className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                  aria-label="Delete conversation"
                  title="Delete conversation"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Thread Search */}
      {sortedItems.length > 1 && (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search in conversation..."
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-300"
              aria-label="Search in conversation"
            />
            {threadSearch && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {matchCount}/{sortedItems.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm">Loading conversation...</p>
          </div>
        )}

        {isError && (
          <div className="text-center p-6 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
            <p className="font-medium text-sm">Failed to load conversation</p>
            <p className="text-xs mt-1">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !isError && sortedItems.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No messages found in this conversation.</p>
          </div>
        )}

        {!isLoading && !isError && sortedItems.length > 0 && (
          <div className="space-y-3">
            {sortedItems.map((item) => (
              <MessageBubble
                key={item.id}
                item={item}
                searchQuery={threadSearch}
                isMatch={messageMatchesQuery(item.content, threadSearch)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 mx-4 max-w-sm w-full">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete conversation?</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              This will permanently delete all {sortedItems.length} message{sortedItems.length !== 1 ? 's' : ''} in this conversation. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Confirm delete"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
