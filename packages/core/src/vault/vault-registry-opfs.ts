import type { FsTransport } from '../fs/transport';
import { createOpfsTransport } from '../fs/opfs';
import type { VaultRegistry } from './vault-registry';

export async function createOpfsVaultRegistry(): Promise<VaultRegistry> {
  const opfsRoot = await navigator.storage.getDirectory();
  const vaultsDir = await opfsRoot.getDirectoryHandle('vaults', { create: true });
  return new OpfsVaultRegistryImpl(vaultsDir);
}

class OpfsVaultRegistryImpl implements VaultRegistry {
  constructor(private vaultsDir: FileSystemDirectoryHandle) {}

  async list(): Promise<string[]> {
    const names: string[] = [];
    for await (const [name, handle] of this.vaultsDir.entries()) {
      if (handle.kind === 'directory') names.push(name);
    }
    return names;
  }

  async getTransport(projectId: string): Promise<FsTransport> {
    const dir = await this.vaultsDir.getDirectoryHandle(projectId, { create: true });
    return createOpfsTransport(dir);
  }

  async remove(projectId: string): Promise<void> {
    await this.vaultsDir.removeEntry(projectId, { recursive: true });
  }
}
