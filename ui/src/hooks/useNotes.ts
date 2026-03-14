import { useState, useCallback } from 'react';

const STORAGE_KEY = 'wims_notes';

function loadNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveNotes(notes: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function useNotes() {
  const [notes, setNotes] = useState<Record<string, string>>(loadNotes);

  const getNote = useCallback((conversationId: string): string => {
    return notes[conversationId] || '';
  }, [notes]);

  const setNote = useCallback((conversationId: string, text: string) => {
    setNotes(prev => {
      const next = { ...prev };
      if (text.trim()) {
        next[conversationId] = text;
      } else {
        delete next[conversationId];
      }
      saveNotes(next);
      return next;
    });
  }, []);

  return { getNote, setNote };
}
