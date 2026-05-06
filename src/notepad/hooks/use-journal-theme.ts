import { useCallback, useState } from 'react';
import type { JournalTheme } from '../types';

const STORAGE_KEY = 'psalms-journal-theme';

function readInitial(): JournalTheme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as JournalTheme) || 'default';
  } catch {
    return 'default';
  }
}

export function useJournalTheme(): [JournalTheme, (theme: JournalTheme) => void] {
  const [theme, setThemeState] = useState<JournalTheme>(readInitial);

  const setTheme = useCallback((next: JournalTheme) => {
    setThemeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
  }, []);

  return [theme, setTheme];
}
