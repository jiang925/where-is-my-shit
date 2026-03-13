import { X, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

// Define available platforms - matching backend ALLOWED_PLATFORMS
export const AVAILABLE_PLATFORMS = [
  { id: 'chatgpt', label: 'ChatGPT', color: 'bg-green-100 text-green-700 border-green-300' },
  { id: 'claude', label: 'Claude', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { id: 'claude-code', label: 'Claude Code', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { id: 'gemini', label: 'Gemini', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { id: 'perplexity', label: 'Perplexity', color: 'bg-teal-100 text-teal-700 border-teal-300' },
  { id: 'cursor', label: 'Cursor', color: 'bg-purple-100 text-purple-700 border-purple-300' },
] as const;

export type PlatformId = typeof AVAILABLE_PLATFORMS[number]['id'];

interface SourceFilterUIProps {
  selectedPlatforms: PlatformId[];
  onPlatformToggle: (platform: PlatformId) => void;
  onClear: () => void;
  className?: string;
}

export function SourceFilterUI({
  selectedPlatforms,
  onPlatformToggle,
  onClear,
  className
}: SourceFilterUIProps) {
  const hasActiveFilter = selectedPlatforms.length > 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className={cn(
            "h-4 w-4 transition-colors",
            hasActiveFilter ? "text-blue-600" : "text-gray-400 dark:text-gray-500"
          )} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Source
          </span>
          {hasActiveFilter && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              {selectedPlatforms.length} selected
            </span>
          )}
        </div>

        {hasActiveFilter && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {AVAILABLE_PLATFORMS.map((platform) => {
          const isSelected = selectedPlatforms.includes(platform.id);

          return (
            <button
              key={platform.id}
              onClick={() => onPlatformToggle(platform.id)}
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all border cursor-pointer",
                isSelected ? platform.color : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300"
              )}
              aria-label={`Toggle ${platform.label} filter`}
              aria-pressed={isSelected}
            >
              {platform.label}
              {isSelected && (
                <X className="ml-1.5 h-3 w-3" />
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
}
