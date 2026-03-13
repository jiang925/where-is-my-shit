import { useState, useEffect, useCallback, useRef } from 'react';

interface UseKeyboardNavigationOptions {
  itemCount: number;
  onSelect: (index: number) => void;
  onEscape?: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  enabled?: boolean;
}

export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onEscape,
  searchInputRef,
  enabled = true,
}: UseKeyboardNavigationOptions) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Reset focused index when item count changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [itemCount]);

  const scrollToCard = useCallback((index: number) => {
    const card = cardRefs.current.get(index);
    if (card) {
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  const setCardRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(index, el);
    } else {
      cardRefs.current.delete(index);
    }
  }, []);

  // `/` key always works to focus search bar, regardless of `enabled`
  useEffect(() => {
    const handleSlashKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef?.current?.focus();
      }
    };
    document.addEventListener('keydown', handleSlashKey);
    return () => document.removeEventListener('keydown', handleSlashKey);
  }, [searchInputRef]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Arrow keys: navigate results
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        // If in search input, move focus to results
        if (isInput) {
          (target as HTMLElement).blur();
        }
        setFocusedIndex(prev => {
          const next = prev < itemCount - 1 ? prev + 1 : prev;
          scrollToCard(next);
          return next;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(prev => {
          if (prev <= 0) {
            // Move focus back to search bar
            searchInputRef?.current?.focus();
            return -1;
          }
          const next = prev - 1;
          scrollToCard(next);
          return next;
        });
        return;
      }

      // Enter: select focused item
      if (e.key === 'Enter' && !isInput && focusedIndex >= 0) {
        e.preventDefault();
        onSelect(focusedIndex);
        return;
      }

      // Escape: close panel or clear focus
      if (e.key === 'Escape') {
        if (focusedIndex >= 0) {
          setFocusedIndex(-1);
        } else if (onEscape) {
          onEscape();
        }
        return;
      }

      // Home/End: jump to first/last
      if (e.key === 'Home' && !isInput && itemCount > 0) {
        e.preventDefault();
        setFocusedIndex(0);
        scrollToCard(0);
        return;
      }

      if (e.key === 'End' && !isInput && itemCount > 0) {
        e.preventDefault();
        const last = itemCount - 1;
        setFocusedIndex(last);
        scrollToCard(last);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, itemCount, focusedIndex, onSelect, onEscape, searchInputRef, scrollToCard]);

  return { focusedIndex, setFocusedIndex, setCardRef };
}
