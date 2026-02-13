import { X, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

// Define available platforms
export const AVAILABLE_PLATFORMS = [
  { id: 'claude', label: 'Claude', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { id: 'chrome', label: 'Chrome', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { id: 'terminal', label: 'Terminal', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { id: 'files', label: 'Files', color: 'bg-purple-100 text-purple-700 border-purple-300' },
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
            hasActiveFilter ? "text-blue-600" : "text-gray-400"
          )} />
          <span className="text-sm font-medium text-gray-700">
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
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:text-red-600 transition-colors"
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
                "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                isSelected ? platform.color : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
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

      {hasActiveFilter && (
        <p className="text-xs text-gray-500 italic">
          Showing results from: {selectedPlatforms.map(p =>
            AVAILABLE_PLATFORMS.find(ap => ap.id === p)?.label
          ).join(', ')}
        </p>
      )}
    </div>
  );
}
