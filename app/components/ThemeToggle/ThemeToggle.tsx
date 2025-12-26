'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './ThemeToggle.module.css';

type ThemeMode = 'light' | 'dark';
type ThemePreference = 'system' | ThemeMode;

const THEME_STORAGE_KEY = 'theme-preference';

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
    return;
  }
  root.setAttribute('data-theme', theme);
}

function getStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    return 'system';
  }
  return 'system';
}


export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [systemTheme, setSystemTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const storedTheme = getStoredTheme();
    setPreference(storedTheme);
    applyTheme(storedTheme);

    if (!window.matchMedia) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(media.matches ? 'dark' : 'light');

    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const effectiveTheme = useMemo(
    () => (preference === 'system' ? systemTheme : preference),
    [preference, systemTheme]
  );

  function handleToggle(checked: boolean) {
    const nextTheme: ThemeMode = checked ? 'dark' : 'light';
    setPreference(nextTheme);
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage errors
    }
  }

  return (
    <div className={styles.container}>
      <span className={styles.label}>Theme</span>
      <div className={styles.toggleRow}>
        <span className={styles.modeText}>Light</span>
        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={effectiveTheme === 'dark'}
            onChange={(event) => handleToggle(event.target.checked)}
            aria-label="Toggle dark mode"
          />
          <span className={styles.slider} />
        </label>
        <span className={styles.modeText}>Dark</span>
      </div>
    </div>
  );
}
