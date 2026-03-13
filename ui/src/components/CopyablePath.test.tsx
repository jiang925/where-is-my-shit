import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CopyablePath } from './CopyablePath';

// Mock the api module to prevent real HTTP calls
vi.mock('../lib/api', () => ({
  openTerminal: vi.fn().mockResolvedValue({ opened: '/some/path' }),
}));

describe('CopyablePath', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays the path text (truncated)', () => {
    render(<CopyablePath path="/Users/test/short.txt" />);
    expect(screen.getByText('/Users/test/short.txt')).toBeInTheDocument();
  });

  it('shows full path in title attribute for tooltip', () => {
    const longPath = '/Users/test/very/long/nested/directory/structure/file.txt';
    render(<CopyablePath path={longPath} />);
    const codeEl = screen.getByTitle(longPath);
    expect(codeEl).toBeInTheDocument();
  });

  it('shows "Copy Path" button that changes to "Copied!" after click', async () => {
    render(<CopyablePath path="/test/path.txt" />);
    expect(screen.getByText('Copy Path')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Copy Path'));
    });

    expect(screen.getByText('Copied!')).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/test/path.txt');
  });

  it('reverts "Copied!" back to "Copy Path" after 2 seconds', async () => {
    render(<CopyablePath path="/test/path.txt" />);

    await act(async () => {
      fireEvent.click(screen.getByText('Copy Path'));
    });

    expect(screen.getByText('Copied!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Copy Path')).toBeInTheDocument();
  });

  it('shows "Terminal" button with open-in-terminal aria label', () => {
    render(<CopyablePath path="/test/path.txt" />);
    const terminalButton = screen.getByLabelText('Open in terminal');
    expect(terminalButton).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });
});
