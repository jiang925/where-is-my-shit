import { ExternalLink, MessageSquare, Chrome, Terminal, FileCode } from 'lucide-react';
import type { SearchResult } from '../lib/api';
import { cn } from '../lib/utils';

interface ResultCardProps {
  result: SearchResult;
  className?: string;
}

// Platform configuration matching SourceFilterUI for consistency
const PLATFORM_CONFIG: Record<string, {
  icon: React.ElementType;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  claude: {
    icon: MessageSquare,
    label: 'Claude',
    colorClass: 'text-orange-700',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200',
  },
  chrome: {
    icon: Chrome,
    label: 'Chrome',
    colorClass: 'text-blue-700',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
  },
  terminal: {
    icon: Terminal,
    label: 'Terminal',
    colorClass: 'text-gray-700',
    bgClass: 'bg-gray-50',
    borderClass: 'border-gray-200',
  },
  files: {
    icon: FileCode,
    label: 'Files',
    colorClass: 'text-purple-700',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
  },
  file: {
    icon: FileCode,
    label: 'Files',
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

  const s = source.toLowerCase();

  if (s.includes('claude') || s.includes('ai')) return PLATFORM_CONFIG.claude;
  if (s.includes('chrome') || s.includes('web')) return PLATFORM_CONFIG.chrome;
  if (s.includes('terminal') || s.includes('shell')) return PLATFORM_CONFIG.terminal;
  if (s.includes('file') || s.includes('code')) return PLATFORM_CONFIG.file || PLATFORM_CONFIG.files;

  // Default config for unknown sources
  return {
    icon: MessageSquare,
    label: source,
    colorClass: 'text-gray-700',
    bgClass: 'bg-gray-50',
    borderClass: 'border-gray-200',
  };
}

export function ResultCard({ result, className }: ResultCardProps) {
  const { content, meta } = result;
  const platform = getPlatformConfig(meta.source);
  const Icon = platform?.icon || MessageSquare;

  const title = meta.title || meta.url || 'Untitled Conversation';

  return (
    <div className={cn(
      "group flex flex-col bg-white border border-gray-100 hover:border-blue-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all",
      className
    )}>
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

        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
          Score: {result.score.toFixed(2)}
        </div>
      </div>

      <div className="mb-3">
        <h3 className="font-medium text-gray-900 truncate mb-1" title={title}>
          {title}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-3 font-mono bg-gray-50 p-2 rounded">
          {content}
        </p>
      </div>

      <div className="mt-auto pt-2 flex justify-between items-center">
        {/* Conversation ID for reference */}
        {meta.conversation_id && (
          <span className="text-xs text-gray-400 font-mono">
            ID: {meta.conversation_id.slice(0, 8)}...
          </span>
        )}

        {meta.url && (
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
        )}
      </div>
    </div>
  );
}
