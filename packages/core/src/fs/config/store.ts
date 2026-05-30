import { STORAGE_KEYS } from '../../constants';
import type { StorageProviderConfig } from './providers';
import { generateProviderId } from './providers';
import { normalizeLegacyEntry } from './legacy-compat';
import { updateProviderIdReferences } from '../../vault/notebook-remotes';

export type StorageProviderEntry = StorageProviderConfig & { id: string };

export interface StorageProviderStore {
  listProviders(): StorageProviderEntry[];
  getProvider(id: string): StorageProviderEntry | null;
  saveProvider(config: StorageProviderConfig): StorageProviderEntry;
  deleteProvider(id: string): void;
}

type RawEntry = Record<string, unknown>;

function parseEntry(raw: RawEntry): StorageProviderEntry | null {
  const result = normalizeLegacyEntry(raw);
  if (!result) return null;
  if (result.oldId) {
    updateProviderIdReferences(result.oldId, result.entry.id);
  }
  return result.entry;
}

function toEntry(config: StorageProviderConfig): StorageProviderEntry {
  return { ...config, id: generateProviderId(config) };
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
      const entry = toEntry(config);
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

let defaultStore: StorageProviderStore | null = null;

function getStore(): StorageProviderStore | null {
  if (!defaultStore && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    defaultStore = createLocalStorageProviderStore();
  }
  return defaultStore;
}

export function listProviders(): StorageProviderEntry[] {
  return getStore()?.listProviders() ?? [];
}

export function getProvider(id: string): StorageProviderEntry | null {
  return getStore()?.getProvider(id) ?? null;
}

export function saveProvider(config: StorageProviderConfig): StorageProviderEntry {
  const store = getStore();
  if (!store) throw new Error('ProviderStore not available (no window/localStorage)');
  return store.saveProvider(config);
}

export function deleteProvider(id: string): void {
  const store = getStore();
  if (!store) return;
  store.deleteProvider(id);
}
