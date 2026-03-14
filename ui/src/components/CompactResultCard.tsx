import { MessageSquare, Terminal, FileCode } from 'lucide-react';
import type { SearchResult } from '../lib/api';
import { cn } from '../lib/utils';

interface CompactResultCardProps {
  result: SearchResult;
  onSelect?: (conversationId: string, messageId?: string) => void;
  isSelected?: boolean;
  isFocused?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  'claude-code': Terminal,
  cursor: FileCode,
};

function timeAgo(timestamp: number) {
  if (!timestamp) return '';
  const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = (ms - Date.now()) / 1000;
  if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (Math.abs(diff) < 2592000) return rtf.format(Math.round(diff / 86400), 'day');
  return rtf.format(Math.round(diff / 2592000), 'month');
}

const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: 'text-green-600',
  claude: 'text-amber-600',
  'claude-code': 'text-orange-600',
  gemini: 'text-blue-600',
  perplexity: 'text-teal-600',
  cursor: 'text-purple-600',
};

export function CompactResultCard({ result, onSelect, isSelected, isFocused, cardRef }: CompactResultCardProps) {
  const { meta } = result;
  const Icon = PLATFORM_ICONS[meta.source?.toLowerCase()] || MessageSquare;
  const title = meta.title || 'Untitled';
  const firstMsg = (meta.first_user_message as string) || result.content;
  const snippet = firstMsg.slice(0, 80) + (firstMsg.length > 80 ? '...' : '');
  const colorClass = PLATFORM_COLORS[meta.source?.toLowerCase()] || 'text-gray-600';

  return (
    <div
      ref={cardRef}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg border transition-all",
        onSelect ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : "",
        isSelected
          ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
          : isFocused
            ? "border-blue-300 bg-blue-50/50 dark:bg-blue-900/10"
            : "border-gray-100 dark:border-gray-700"
      )}
      onClick={() => onSelect && meta.conversation_id && onSelect(meta.conversation_id, result.id)}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(meta.conversation_id!, result.id); } } : undefined}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", colorClass)} />
      <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate min-w-0 max-w-[200px]">
        {title}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1 min-w-0">
        {snippet}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
        {timeAgo(meta.created_at)}
      </span>
    </div>
  );
}
