import { useState, useCallback } from 'react';

const STORAGE_KEY = 'wims-search-history';
const MAX_ITEMS = 10;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function saveHistory(items: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(loadHistory);

  const add = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setHistory(prev => {
      const filtered = prev.filter(q => q !== trimmed);
      const next = [trimmed, ...filtered].slice(0, MAX_ITEMS);
      saveHistory(next);
      return next;
    });
  }, []);

  const remove = useCallback((query: string) => {
    setHistory(prev => {
      const next = prev.filter(q => q !== query);
      saveHistory(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, add, remove, clear };
}
