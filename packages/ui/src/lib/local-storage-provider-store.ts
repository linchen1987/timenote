import {
  type FsProviderAccount,
  type FsProviderEntry,
  type FsProviderStore,
  STORAGE_KEYS,
  toProviderEntry,
} from '@timenote/core';
import { normalizeLegacyEntry } from './legacy-compat';

type RawEntry = Record<string, unknown>;

function parseEntry(raw: RawEntry): FsProviderEntry | null {
  const result = normalizeLegacyEntry(raw);
  if (!result) return null;
  return result.entry;
}

export function createLocalStorageProviderStore(): FsProviderStore {
  function read(): FsProviderEntry[] {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.PROVIDERS);
      if (!json) return [];
      const raws: RawEntry[] = JSON.parse(json);
      const entries: FsProviderEntry[] = [];
      for (const raw of raws) {
        const entry = parseEntry(raw);
        if (entry) entries.push(entry);
      }
      return entries;
    } catch {
      return [];
    }
  }

  function write(entries: FsProviderEntry[]): void {
    localStorage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(entries));
  }

  return {
    listProviders(): FsProviderEntry[] {
      return read();
    },
    getProvider(id: string): FsProviderAccount | null {
      return read().find((p) => p.id === id) ?? null;
    },
    saveProvider(account: FsProviderAccount): FsProviderEntry {
      const entry = toProviderEntry(account);
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
