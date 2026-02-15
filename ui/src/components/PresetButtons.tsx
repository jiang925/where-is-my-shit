import { Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { AVAILABLE_PLATFORMS, type PlatformId } from './SourceFilterUI';

interface PresetButtonsProps {
  selectedPlatforms: PlatformId[];
  onPresetSelect: (platforms: PlatformId[]) => void;
  className?: string;
}

// All platform IDs for the "All Sources" preset
const ALL_PLATFORM_IDS = AVAILABLE_PLATFORMS.map(p => p.id) as PlatformId[];

// Define preset configurations
const PRESETS = [
  {
    name: 'Web Chats Only',
    platforms: ['chatgpt', 'claude', 'gemini', 'perplexity'] as PlatformId[],
    icon: Zap,
  },
  {
    name: 'Dev Sessions Only',
    platforms: ['claude-code', 'cursor'] as PlatformId[],
    icon: Zap,
  },
  {
    name: 'All Sources',
    platforms: ALL_PLATFORM_IDS,
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
    return presetPlatforms.length === selectedPlatforms.length &&
      presetPlatforms.every(p => selectedPlatforms.includes(p));
  };

  const handlePresetClick = (presetPlatforms: PlatformId[]) => {
    // "All Sources" always selects all — not a toggle
    if (presetPlatforms.length === ALL_PLATFORM_IDS.length) {
      onPresetSelect(ALL_PLATFORM_IDS);
      return;
    }
    // Other presets toggle on/off
    if (isPresetActive(presetPlatforms)) {
      onPresetSelect([]);
    } else {
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
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border cursor-pointer",
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
