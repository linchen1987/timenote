import type { FsClient } from '@timenote/core';
import type { VaultRegistry, VaultRegistryEntry } from '@timenote/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { addVaultEntry, getConfig, loadConfig, removeVaultEntry, type VaultEntry } from './desktop-config';
import { TauriFsClient } from './tauri-fs-driver';

function toEntry(v: VaultEntry): VaultRegistryEntry {
  return {
    projectId: v.projectId,
    sourceUrl: `localfs://${v.path}`,
    name: v.name,
  };
}

export async function createDesktopVaultRegistry(): Promise<
  VaultRegistry & {
    registerExisting(projectId: string, path: string, name: string): Promise<VaultRegistryEntry>;
    getVaultPath(projectId: string): Promise<string | null>;
  }
> {
  await loadConfig();

  return {
    async list(): Promise<VaultRegistryEntry[]> {
      return getConfig().vaults.map(toEntry);
    },

    async get(projectId: string): Promise<VaultRegistryEntry | null> {
      const v = getConfig().vaults.find((x) => x.projectId === projectId);
      return v ? toEntry(v) : null;
    },

    async register(projectId: string, name: string): Promise<VaultRegistryEntry> {
      const vaultsDir = await join(await appDataDir(), 'vaults', projectId);
      await addVaultEntry({ projectId, name, path: vaultsDir });
      return toEntry({ projectId, name, path: vaultsDir });
    },

    async registerExisting(
      projectId: string,
      path: string,
      name: string,
    ): Promise<VaultRegistryEntry> {
      const existing = getConfig().vaults.find((x) => x.projectId === projectId);
      if (existing) throw new Error(`Vault already registered: ${projectId}`);
      await addVaultEntry({ projectId, name, path });
      return toEntry({ projectId, name, path });
    },

    async unregister(projectId: string): Promise<void> {
      await removeVaultEntry(projectId);
    },

    async destroy(projectId: string): Promise<void> {
      await removeVaultEntry(projectId);
    },

    async getLocalClient(projectId: string): Promise<FsClient> {
      const v = getConfig().vaults.find((x) => x.projectId === projectId);
      if (!v) throw new Error(`Vault not found: ${projectId}`);
      return new TauriFsClient(v.path);
    },

    async getVaultPath(projectId: string): Promise<string | null> {
      const v = getConfig().vaults.find((x) => x.projectId === projectId);
      return v?.path ?? null;
    },
  };
}
