import type { FsClient } from '../fs/types';
import { createOpfsClient } from '../fs/adapters/localfs/opfs';
import type { VaultRegistry, VaultRegistryEntry } from './vault-registry';

export async function createOpfsVaultRegistry(): Promise<VaultRegistry> {
  const opfsRoot = await navigator.storage.getDirectory();
  const vaultsDir = await opfsRoot.getDirectoryHandle('vaults', { create: true });
  return new OpfsVaultRegistryImpl(vaultsDir);
}

class OpfsVaultRegistryImpl implements VaultRegistry {
  constructor(private vaultsDir: FileSystemDirectoryHandle) {}

  async list(): Promise<VaultRegistryEntry[]> {
    const entries: VaultRegistryEntry[] = [];
    for await (const [name, handle] of this.vaultsDir.entries()) {
      if (handle.kind === 'directory') {
        entries.push(this.toEntry(name));
      }
    }
    return entries;
  }

  async get(projectId: string): Promise<VaultRegistryEntry | null> {
    try {
      await this.vaultsDir.getDirectoryHandle(projectId);
      return this.toEntry(projectId);
    } catch {
      return null;
    }
  }

  async register(projectId: string, name: string): Promise<VaultRegistryEntry> {
    await this.vaultsDir.getDirectoryHandle(projectId, { create: true });
    return this.toEntry(projectId, name);
  }

  async unregister(projectId: string): Promise<void> {
    await this.vaultsDir.removeEntry(projectId, { recursive: true });
  }

  async destroy(projectId: string): Promise<void> {
    await this.vaultsDir.removeEntry(projectId, { recursive: true });
  }

  async getProvider(projectId: string): Promise<FsClient> {
    const dir = await this.vaultsDir.getDirectoryHandle(projectId, { create: true });
    return createOpfsClient(dir);
  }

  private toEntry(projectId: string, name?: string): VaultRegistryEntry {
    return {
      projectId,
      sourceUrl: `localfs:///vaults/${projectId}`,
      name: name ?? projectId,
    };
  }
}
