import { useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'wims_bookmarks';

function loadBookmarks(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // Corrupted data, reset
  }
  return new Set();
}

function saveBookmarks(bookmarks: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...bookmarks]));
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadBookmarks);

  const toggle = useCallback((conversationId: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      saveBookmarks(next);
      return next;
    });
  }, []);

  const isBookmarked = useCallback((conversationId: string) => {
    return bookmarks.has(conversationId);
  }, [bookmarks]);

  const count = useMemo(() => bookmarks.size, [bookmarks]);

  return { toggle, isBookmarked, count };
}
