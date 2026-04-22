import { useEffect, useState } from 'react';

export function useLocalStorage(key: string, initialValue: string) {
  const [value, setValue] = useState(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setValue(stored);
      }
      setIsHydrated(true);
    }
  }, [key]);

  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }, [key, value, isHydrated]);

  return [value, setValue] as const;
}
