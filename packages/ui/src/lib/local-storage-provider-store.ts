import {
  computeVolumeUrl,
  type FsVolumeAccess,
  type FsVolumeAccessStore,
  STORAGE_KEYS,
} from '@timenote/core';
import { normalizeLegacyEntry } from './legacy-compat';

type VolumeAccessEntry = FsVolumeAccess & { volumeUrl: string };
type RawEntry = Record<string, unknown>;

function parseEntry(raw: RawEntry): VolumeAccessEntry | null {
  const result = normalizeLegacyEntry(raw);
  if (!result) return null;
  return result.entry;
}

export function createLocalStorageProviderStore(): FsVolumeAccessStore {
  function read(): VolumeAccessEntry[] {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.PROVIDERS);
      if (!json) return [];
      const raws: RawEntry[] = JSON.parse(json);
      const entries: VolumeAccessEntry[] = [];
      for (const raw of raws) {
        const entry = parseEntry(raw);
        if (entry) entries.push(entry);
      }
      return entries;
    } catch {
      return [];
    }
  }

  function write(entries: VolumeAccessEntry[]): void {
    localStorage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(entries));
  }

  return {
    listVolumeAccesses(): VolumeAccessEntry[] {
      return read();
    },
    getVolumeAccess(volumeUrl: string): FsVolumeAccess | null {
      return read().find((p) => p.volumeUrl === volumeUrl) ?? null;
    },
    saveVolumeAccess(access: FsVolumeAccess): VolumeAccessEntry {
      const entry: VolumeAccessEntry = { ...access, volumeUrl: computeVolumeUrl(access) };
      const providers = read();
      const idx = providers.findIndex((p) => p.volumeUrl === entry.volumeUrl);
      if (idx >= 0) {
        providers[idx] = entry;
      } else {
        providers.push(entry);
      }
      write(providers);
      return entry;
    },
    deleteVolumeAccess(volumeUrl: string): void {
      write(read().filter((p) => p.volumeUrl !== volumeUrl));
    },
  };
}
