import { computeVolumeUrl, type FsVolumeAccess, type FsVolumeAccessStore } from '@timenote/core';
import { getConfig, saveProviders, type VolumeAccessEntry } from './desktop-config';

export function createDesktopFileProviderStore(): FsVolumeAccessStore {
  return {
    listVolumeAccesses(): VolumeAccessEntry[] {
      return getConfig().providers;
    },

    getVolumeAccess(volumeUrl: string): FsVolumeAccess | null {
      return getConfig().providers.find((p) => p.volumeUrl === volumeUrl) ?? null;
    },

    saveVolumeAccess(access: FsVolumeAccess): VolumeAccessEntry {
      const entry: VolumeAccessEntry = { ...access, volumeUrl: computeVolumeUrl(access) };
      const cfg = getConfig();
      const idx = cfg.providers.findIndex((p) => p.volumeUrl === entry.volumeUrl);
      if (idx >= 0) cfg.providers[idx] = entry;
      else cfg.providers.push(entry);
      saveProviders(cfg.providers).catch(() => {});
      return entry;
    },

    deleteVolumeAccess(volumeUrl: string): void {
      const cfg = getConfig();
      cfg.providers = cfg.providers.filter((p) => p.volumeUrl !== volumeUrl);
      saveProviders(cfg.providers).catch(() => {});
    },
  };
}
