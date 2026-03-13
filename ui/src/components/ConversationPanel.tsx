import { useEffect, useCallback } from 'react';
import { X, ExternalLink, Download, Loader2, MessageSquare, Terminal, FileCode } from 'lucide-react';
import { useConversation, type ThreadItem } from '../lib/api';
import { cn } from '../lib/utils';

interface ConversationPanelProps {
  conversationId: string;
  onClose: () => void;
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

function MessageBubble({ item }: { item: ThreadItem }) {
  const isUser = isUserRole(item.role);

  return (
    <div
      className={cn(
        'rounded-lg p-4 border-l-4',
        isUser
          ? 'bg-blue-50 border-l-blue-300'
          : 'bg-white border-l-gray-300'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          isUser ? 'text-blue-600' : 'text-gray-500'
        )}>
          {isUser ? 'You' : 'Assistant'}
        </span>
        <time className="text-xs text-gray-400">
          {formatTimestamp(item.timestamp)}
        </time>
      </div>
      <div className="text-sm text-gray-800 whitespace-pre-wrap break-words font-mono">
        {item.content}
      </div>
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

export function ConversationPanel({ conversationId, onClose }: ConversationPanelProps) {
  const { data, isLoading, isError, error } = useConversation(conversationId);

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white p-4">
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
            <h2 className="text-sm font-semibold text-gray-900 truncate" title={title}>
              {title}
            </h2>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
              >
                Open original
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-1">
            {sortedItems.length > 0 && (
              <button
                onClick={handleExport}
                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                aria-label="Export as markdown"
                title="Export as markdown"
              >
                <Download className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm">Loading conversation...</p>
          </div>
        )}

        {isError && (
          <div className="text-center p-6 text-red-500 bg-red-50 rounded-lg border border-red-100">
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
              <MessageBubble key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
