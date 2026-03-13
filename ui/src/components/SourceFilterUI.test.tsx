import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SourceFilterUI, AVAILABLE_PLATFORMS, type PlatformId } from './SourceFilterUI';

describe('SourceFilterUI', () => {
  const onPlatformToggle = vi.fn();
  const onClear = vi.fn();

  function renderFilter(selectedPlatforms: PlatformId[] = []) {
    return render(
      <SourceFilterUI
        selectedPlatforms={selectedPlatforms}
        onPlatformToggle={onPlatformToggle}
        onClear={onClear}
      />
    );
  }

  it('renders all platform chips', () => {
    renderFilter();
    for (const platform of AVAILABLE_PLATFORMS) {
      expect(screen.getByText(platform.label)).toBeInTheDocument();
    }
  });

  it('calls onPlatformToggle when a platform chip is clicked', () => {
    renderFilter();
    fireEvent.click(screen.getByLabelText('Toggle ChatGPT filter'));
    expect(onPlatformToggle).toHaveBeenCalledWith('chatgpt');
  });

  it('shows selected count badge when platforms are selected', () => {
    renderFilter(['chatgpt', 'claude']);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('does not show selected count badge when no platforms are selected', () => {
    renderFilter([]);
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('shows Clear button when platforms are selected and calls onClear', () => {
    renderFilter(['chatgpt']);
    const clearButton = screen.getByText('Clear');
    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalled();
  });

  it('hides Clear button when no platforms are selected', () => {
    renderFilter([]);
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('sets aria-pressed=true on selected platforms', () => {
    renderFilter(['claude']);
    const claudeButton = screen.getByLabelText('Toggle Claude filter');
    expect(claudeButton).toHaveAttribute('aria-pressed', 'true');

    const chatgptButton = screen.getByLabelText('Toggle ChatGPT filter');
    expect(chatgptButton).toHaveAttribute('aria-pressed', 'false');
  });
});
