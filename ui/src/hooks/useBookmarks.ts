import { useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'wims_bookmarks';
const PINS_STORAGE_KEY = 'wims_pinned';

function loadSet(key: string): Set<string> {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // Corrupted data, reset
  }
  return new Set();
}

function saveSet(key: string, data: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...data]));
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => loadSet(STORAGE_KEY));
  const [pinned, setPinned] = useState<Set<string>>(() => loadSet(PINS_STORAGE_KEY));

  const toggle = useCallback((conversationId: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(conversationId)) {
        next.delete(conversationId);
        // Also unpin when unbookmarking
        setPinned(prevPins => {
          const nextPins = new Set(prevPins);
          nextPins.delete(conversationId);
          saveSet(PINS_STORAGE_KEY, nextPins);
          return nextPins;
        });
      } else {
        next.add(conversationId);
      }
      saveSet(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const togglePin = useCallback((conversationId: string) => {
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      saveSet(PINS_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const isBookmarked = useCallback((conversationId: string) => {
    return bookmarks.has(conversationId);
  }, [bookmarks]);

  const isPinned = useCallback((conversationId: string) => {
    return pinned.has(conversationId);
  }, [pinned]);

  const count = useMemo(() => bookmarks.size, [bookmarks]);
  const pinnedIds = useMemo(() => [...pinned], [pinned]);

  return { toggle, isBookmarked, count, togglePin, isPinned, pinnedIds };
}
