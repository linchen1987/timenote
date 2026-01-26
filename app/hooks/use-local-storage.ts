import { useEffect, useState } from 'react';

// Hook for safe local storage usage with hydration support
export function useLocalStorage(key: string, initialValue: string) {
  // Initialize with initialValue to avoid hydration mismatch
  const [value, setValue] = useState(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Check if running in browser
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
