import { useEffect, useState } from 'react';

/**
 * `migrate` runs once on the stored value when it is read, letting callers
 * upgrade data written by an earlier version of the app. The write-back effect
 * below then persists the upgraded shape. It must be idempotent, since it also
 * runs on values that are already current.
 */
export function useLocalStorage(key, initialValue, migrate) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return initialValue;
      const parsed = JSON.parse(stored);
      return migrate ? migrate(parsed) : parsed;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage unavailable (e.g. private browsing quota) - ignore
    }
  }, [key, value]);

  return [value, setValue];
}
