import {
  computeVolumeUrl,
  type FsVolumeCredential,
  type FsVolumeCredentialStore,
  STORAGE_KEYS,
} from '@timenote/core';
import { normalizeLegacyEntry } from './legacy-compat';

type VolumeCredentialEntry = FsVolumeCredential & { volumeUrl: string };
type RawEntry = Record<string, unknown>;

function parseEntry(raw: RawEntry): VolumeCredentialEntry | null {
  return normalizeLegacyEntry(raw);
}

export function createLocalStorageProviderStore(): FsVolumeCredentialStore {
  function read(): VolumeCredentialEntry[] {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.PROVIDERS);
      if (!json) return [];
      const raws: RawEntry[] = JSON.parse(json);
      const entries: VolumeCredentialEntry[] = [];
      for (const raw of raws) {
        const entry = parseEntry(raw);
        if (entry) entries.push(entry);
      }
      return entries;
    } catch {
      return [];
    }
  }

  function write(entries: VolumeCredentialEntry[]): void {
    localStorage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(entries));
  }

  return {
    listVolumeCredentials(): VolumeCredentialEntry[] {
      return read();
    },
    getVolumeCredential(volumeUrl: string): FsVolumeCredential | null {
      return read().find((p) => p.volumeUrl === volumeUrl) ?? null;
    },
    saveVolumeCredential(credential: FsVolumeCredential): VolumeCredentialEntry {
      const entry: VolumeCredentialEntry = {
        ...credential,
        volumeUrl: computeVolumeUrl(credential),
      };
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
    deleteVolumeCredential(volumeUrl: string): void {
      write(read().filter((p) => p.volumeUrl !== volumeUrl));
    },
  };
}
