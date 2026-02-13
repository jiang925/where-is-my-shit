import { Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import type { PlatformId } from './SourceFilterUI';

interface PresetButtonsProps {
  selectedPlatforms: PlatformId[];
  onPresetSelect: (platforms: PlatformId[]) => void;
  className?: string;
}

// Define preset configurations
const PRESETS = [
  {
    name: 'Web Chats Only',
    platforms: ['chatgpt', 'claude', 'gemini'] as PlatformId[],
    icon: Zap,
  },
  {
    name: 'Dev Sessions Only',
    platforms: ['claude-code', 'cursor'] as PlatformId[],
    icon: Zap,
  },
  {
    name: 'All Sources',
    platforms: [] as PlatformId[], // Empty array means clear all filters
    icon: Zap,
  },
];

export function PresetButtons({
  selectedPlatforms,
  onPresetSelect,
  className
}: PresetButtonsProps) {
  // Check if a preset is currently active
  const isPresetActive = (presetPlatforms: PlatformId[]) => {
    if (presetPlatforms.length === 0) {
      // "All Sources" preset is active when no platforms are selected
      return selectedPlatforms.length === 0;
    }

    // Check if selected platforms exactly match preset
    return presetPlatforms.length === selectedPlatforms.length &&
      presetPlatforms.every(p => selectedPlatforms.includes(p));
  };

  const handlePresetClick = (presetPlatforms: PlatformId[]) => {
    // If preset is already active, deactivate it (clear all)
    if (isPresetActive(presetPlatforms)) {
      onPresetSelect([]);
    } else {
      // Apply the preset
      onPresetSelect(presetPlatforms);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <span className="text-xs text-gray-500 font-medium self-center mr-1">
        Quick filters:
      </span>
      {PRESETS.map((preset) => {
        const isActive = isPresetActive(preset.platforms);
        const Icon = preset.icon;

        return (
          <button
            key={preset.name}
            onClick={() => handlePresetClick(preset.platforms)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
              isActive
                ? "bg-blue-100 text-blue-700 border-blue-300"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
            )}
            aria-label={`Apply ${preset.name} preset`}
            aria-pressed={isActive}
          >
            <Icon className="h-3 w-3" />
            {preset.name}
          </button>
        );
      })}
    </div>
  );
}
