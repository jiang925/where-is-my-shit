import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PresetButtons } from './PresetButtons';
import type { PlatformId } from './SourceFilterUI';

describe('PresetButtons', () => {
  const onPresetSelect = vi.fn();

  function renderPresets(selectedPlatforms: PlatformId[] = []) {
    return render(
      <PresetButtons
        selectedPlatforms={selectedPlatforms}
        onPresetSelect={onPresetSelect}
      />
    );
  }

  it('renders all preset buttons', () => {
    renderPresets();
    expect(screen.getByText('Web Chats Only')).toBeInTheDocument();
    expect(screen.getByText('Dev Sessions Only')).toBeInTheDocument();
    expect(screen.getByText('All Sources')).toBeInTheDocument();
  });

  it('calls onPresetSelect with web chat platforms when "Web Chats Only" is clicked', () => {
    renderPresets();
    fireEvent.click(screen.getByLabelText('Apply Web Chats Only preset'));
    expect(onPresetSelect).toHaveBeenCalledWith(['chatgpt', 'claude', 'gemini', 'perplexity']);
  });

  it('"Web Chats Only" includes perplexity', () => {
    renderPresets();
    fireEvent.click(screen.getByLabelText('Apply Web Chats Only preset'));
    const calledWith = onPresetSelect.mock.calls[0][0] as PlatformId[];
    expect(calledWith).toContain('perplexity');
  });

  it('toggles off an active non-All preset by calling onPresetSelect([])', () => {
    // "Web Chats Only" is active when these exact platforms are selected
    renderPresets(['chatgpt', 'claude', 'gemini', 'perplexity']);
    fireEvent.click(screen.getByLabelText('Apply Web Chats Only preset'));
    expect(onPresetSelect).toHaveBeenCalledWith([]);
  });

  it('"All Sources" always selects all platforms (never toggles off)', () => {
    // Even when All Sources is already active, clicking it should still call with all
    renderPresets(['chatgpt', 'claude', 'claude-code', 'gemini', 'perplexity', 'cursor']);
    fireEvent.click(screen.getByLabelText('Apply All Sources preset'));
    expect(onPresetSelect).toHaveBeenCalledWith(
      ['chatgpt', 'claude', 'claude-code', 'gemini', 'perplexity', 'cursor']
    );
  });

  it('sets aria-pressed=true on the active preset', () => {
    renderPresets(['claude-code', 'cursor']);
    const devButton = screen.getByLabelText('Apply Dev Sessions Only preset');
    expect(devButton).toHaveAttribute('aria-pressed', 'true');

    const webButton = screen.getByLabelText('Apply Web Chats Only preset');
    expect(webButton).toHaveAttribute('aria-pressed', 'false');
  });
});
