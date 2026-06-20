import {
  computeVolumeUrl,
  type FsVolumeCredential,
  type FsVolumeCredentialStore,
} from '@timenote/core';
import { getConfig, saveProviders, type VolumeCredentialEntry } from './desktop-config';

export function createDesktopFileProviderStore(): FsVolumeCredentialStore {
  return {
    listVolumeCredentials(): VolumeCredentialEntry[] {
      return getConfig().providers;
    },

    getVolumeCredential(volumeUrl: string): FsVolumeCredential | null {
      return getConfig().providers.find((p) => p.volumeUrl === volumeUrl) ?? null;
    },

    saveVolumeCredential(credential: FsVolumeCredential): VolumeCredentialEntry {
      const entry: VolumeCredentialEntry = {
        ...credential,
        volumeUrl: computeVolumeUrl(credential),
      };
      const cfg = getConfig();
      const idx = cfg.providers.findIndex((p) => p.volumeUrl === entry.volumeUrl);
      if (idx >= 0) cfg.providers[idx] = entry;
      else cfg.providers.push(entry);
      saveProviders(cfg.providers).catch(() => {});
      return entry;
    },

    deleteVolumeCredential(volumeUrl: string): void {
      const cfg = getConfig();
      cfg.providers = cfg.providers.filter((p) => p.volumeUrl !== volumeUrl);
      saveProviders(cfg.providers).catch(() => {});
    },
  };
}
