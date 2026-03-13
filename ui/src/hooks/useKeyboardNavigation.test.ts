import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRef } from 'react';
import { useKeyboardNavigation } from './useKeyboardNavigation';

describe('useKeyboardNavigation', () => {
  const onSelect = vi.fn();
  const onEscape = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with focusedIndex -1', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ itemCount: 5, onSelect })
    );
    expect(result.current.focusedIndex).toBe(-1);
  });

  it('arrow down increments focusedIndex', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ itemCount: 3, onSelect })
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(0);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(1);
  });

  it('arrow down does not exceed itemCount - 1', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ itemCount: 2, onSelect })
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(1);
  });

  it('arrow up decrements focusedIndex', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ itemCount: 3, onSelect })
    );

    // Navigate down first
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(1);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(0);
  });

  it('enter calls onSelect with focusedIndex', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ itemCount: 3, onSelect })
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(0);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('escape resets focusedIndex to -1', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ itemCount: 3, onSelect, onEscape })
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(0);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(-1);
  });

  it('escape calls onEscape when focusedIndex is -1', () => {
    renderHook(() =>
      useKeyboardNavigation({ itemCount: 3, onSelect, onEscape })
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onEscape).toHaveBeenCalled();
  });

  it('does nothing when enabled is false', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ itemCount: 3, onSelect, enabled: false })
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(-1);
  });

  it('resets focusedIndex when itemCount changes', () => {
    const { result, rerender } = renderHook(
      ({ itemCount }) => useKeyboardNavigation({ itemCount, onSelect }),
      { initialProps: { itemCount: 3 } }
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(0);

    rerender({ itemCount: 5 });
    expect(result.current.focusedIndex).toBe(-1);
  });

  it('slash key focuses search input ref', () => {
    const inputRef = createRef<HTMLInputElement>();
    const input = document.createElement('input');
    Object.defineProperty(inputRef, 'current', { value: input, writable: true });
    const focusSpy = vi.spyOn(input, 'focus');

    renderHook(() =>
      useKeyboardNavigation({ itemCount: 3, onSelect, searchInputRef: inputRef })
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    });
    expect(focusSpy).toHaveBeenCalled();
  });

  it('Home key jumps to first item', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ itemCount: 5, onSelect })
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(2);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(0);
  });

  it('End key jumps to last item', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ itemCount: 5, onSelect })
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(result.current.focusedIndex).toBe(4);
  });
});
