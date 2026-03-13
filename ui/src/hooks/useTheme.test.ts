import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  let matchMediaListeners: Array<() => void>;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Remove dark class
    document.documentElement.classList.remove('dark');

    matchMediaListeners = [];

    // Mock matchMedia to return light by default
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false, // system prefers light
        media: query,
        addEventListener: vi.fn((_event: string, handler: () => void) => {
          matchMediaListeners.push(handler);
        }),
        removeEventListener: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('defaults to "system" theme when localStorage is empty', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });

  it('reads stored theme from localStorage', () => {
    localStorage.setItem('wims_theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('toggleTheme cycles system -> light -> dark -> system', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');

    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('light');

    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('dark');

    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('system');
  });

  it('persists theme to localStorage on setTheme', () => {
    const { result } = renderHook(() => useTheme());

    act(() => { result.current.setTheme('dark'); });
    expect(localStorage.getItem('wims_theme')).toBe('dark');

    act(() => { result.current.setTheme('light'); });
    expect(localStorage.getItem('wims_theme')).toBe('light');
  });

  it('applies dark class to document element when theme is dark', () => {
    const { result } = renderHook(() => useTheme());

    act(() => { result.current.setTheme('dark'); });
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => { result.current.setTheme('light'); });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('resolvedTheme returns the effective theme (resolves system)', () => {
    // matchMedia returns matches=false (light mode)
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');

    act(() => { result.current.setTheme('dark'); });
    expect(result.current.resolvedTheme).toBe('dark');
  });
});
