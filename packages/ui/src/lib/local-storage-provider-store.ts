import {
  STORAGE_KEYS,
  type StorageProviderConfig,
  type StorageProviderEntry,
  type StorageProviderStore,
  toProviderEntry,
} from '@timenote/core';
import { normalizeLegacyEntry } from './legacy-compat';

type RawEntry = Record<string, unknown>;

function parseEntry(raw: RawEntry): StorageProviderEntry | null {
  const result = normalizeLegacyEntry(raw);
  if (!result) return null;
  return result.entry;
}

export function createLocalStorageProviderStore(): StorageProviderStore {
  function read(): StorageProviderEntry[] {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.PROVIDERS);
      if (!json) return [];
      const raws: RawEntry[] = JSON.parse(json);
      const entries: StorageProviderEntry[] = [];
      for (const raw of raws) {
        const entry = parseEntry(raw);
        if (entry) entries.push(entry);
      }
      return entries;
    } catch {
      return [];
    }
  }

  function write(entries: StorageProviderEntry[]): void {
    localStorage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(entries));
  }

  return {
    listProviders(): StorageProviderEntry[] {
      return read();
    },
    getProvider(id: string): StorageProviderEntry | null {
      return read().find((p) => p.id === id) ?? null;
    },
    saveProvider(config: StorageProviderConfig): StorageProviderEntry {
      const entry = toProviderEntry(config);
      const providers = read();
      const idx = providers.findIndex((p) => p.id === entry.id);
      if (idx >= 0) {
        providers[idx] = entry;
      } else {
        providers.push(entry);
      }
      write(providers);
      return entry;
    },
    deleteProvider(id: string): void {
      write(read().filter((p) => p.id !== id));
    },
  };
}
