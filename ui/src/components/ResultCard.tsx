import { ExternalLink, MessageSquare, Chrome, Terminal, FileCode } from 'lucide-react';
import type { SearchResult } from '../lib/api';
import { cn } from '../lib/utils';

interface ResultCardProps {
  result: SearchResult;
  className?: string;
}

// Helper for relative time if we don't want to add date-fns dependency yet
// But date-fns is standard. I'll stick to a simple helper to avoid installing more deps if possible,
// or just use Intl.RelativeTimeFormat.
function timeAgo(timestamp: number) {
  if (!timestamp) return '';
  // timestamp is likely in seconds or milliseconds. Let's assume seconds based on typical backend,
  // but if it's from python time.time() it's seconds float. JS needs ms.
  // Let's check typical usage. If it's < 1e11, it's seconds.
  const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp;

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = (ms - Date.now()) / 1000;

  if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), 'second');
  if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (Math.abs(diff) < 2592000) return rtf.format(Math.round(diff / 86400), 'day');
  return rtf.format(Math.round(diff / 2592000), 'month');
}

const SourceIcon = ({ source }: { source: string }) => {
  const s = source.toLowerCase();
  if (s.includes('chrome') || s.includes('web')) return <Chrome className="h-4 w-4 text-blue-500" />;
  if (s.includes('claude') || s.includes('ai')) return <MessageSquare className="h-4 w-4 text-orange-500" />;
  if (s.includes('terminal') || s.includes('shell')) return <Terminal className="h-4 w-4 text-gray-700" />;
  if (s.includes('file') || s.includes('code')) return <FileCode className="h-4 w-4 text-purple-500" />;
  return <MessageSquare className="h-4 w-4 text-gray-400" />;
};

export function ResultCard({ result, className }: ResultCardProps) {
  const { content, meta } = result;

  // Construct a display title
  const title = meta.title || meta.url || 'Untitled Conversation';

  // Format the snippet (simple truncation if needed, but CSS line-clamp is better)

  return (
    <div className={cn(
      "group flex flex-col bg-white border border-gray-100 hover:border-blue-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all",
      className
    )}>
      <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <SourceIcon source={meta.source || 'unknown'} />
          <span className="font-medium capitalize">{meta.source || 'Unknown Source'}</span>
          <span>•</span>
          <time dateTime={new Date(meta.created_at * 1000).toISOString()}>
            {timeAgo(meta.created_at)}
          </time>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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

      <div className="mt-auto pt-2 flex justify-end">
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
