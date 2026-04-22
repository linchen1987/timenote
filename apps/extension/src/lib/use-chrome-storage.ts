import type { UseStorage } from '@timenote/core';
import { useEffect, useState } from 'react';

export const useChromeStorage: UseStorage = (key, initialValue) => {
  const [value, setValue] = useState(initialValue);
  const [_isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(key).then((result) => {
      if (result[key] !== undefined) {
        setValue(result[key]);
      }
      setIsHydrated(true);
    });
  }, [key]);

  const set = (newValue: string) => {
    setValue(newValue);
    chrome.storage.local.set({ [key]: newValue });
  };

  return [value, set] as const;
};
