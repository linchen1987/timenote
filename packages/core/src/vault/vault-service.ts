import type { FsClient } from '../fs/types';
import { ManifestSchema } from '../spec/manifest';
import { generateProjectId } from '../spec/project-id';
import { metaPath } from '../spec/vault-layout';
import { initVault } from './vault-ops';
import type { VaultRegistry } from './vault-registry';

export interface VaultMeta {
  projectId: string;
  name: string;
  remotePath?: string;
}

export interface VaultService {
  createVault(name: string): Promise<string>;
  createVaultWithId(projectId: string, name: string): Promise<void>;
  deleteVault(projectId: string): Promise<void>;
  listVaults(): Promise<VaultMeta[]>;
  getLocalClient(projectId: string): Promise<FsClient>;
}

export function createVaultService(vaultRegistry: VaultRegistry): VaultService {
  return new VaultServiceImpl(vaultRegistry);
}

class VaultServiceImpl implements VaultService {
  private clients = new Map<string, FsClient>();

  constructor(private vaultRegistry: VaultRegistry) {}

  async createVault(name: string): Promise<string> {
    const projectId = generateProjectId();
    await this.createVaultWithId(projectId, name);
    return projectId;
  }

  async createVaultWithId(projectId: string, name: string): Promise<void> {
    await this.vaultRegistry.register(projectId, name);
    const client = await this.vaultRegistry.getLocalClient(projectId);
    this.clients.set(projectId, client);
    await initVault(client, projectId, name);
  }

  async deleteVault(projectId: string): Promise<void> {
    await this.vaultRegistry.destroy(projectId);
    this.clients.delete(projectId);
  }

  async listVaults(): Promise<VaultMeta[]> {
    const vaults: VaultMeta[] = [];
    const entries = await this.vaultRegistry.list();

    for (const entry of entries) {
      try {
        let client = this.clients.get(entry.projectId);
        if (!client) {
          client = await this.vaultRegistry.getLocalClient(entry.projectId);
          this.clients.set(entry.projectId, client);
        }
        const raw = await client.read(metaPath('manifest'));
        const manifest = ManifestSchema.parse(JSON.parse(raw));
        vaults.push({ projectId: manifest.project_id, name: manifest.name });
      } catch {}
    }

    return vaults;
  }

  async getLocalClient(projectId: string): Promise<FsClient> {
    let client = this.clients.get(projectId);
    if (!client) {
      client = await this.vaultRegistry.getLocalClient(projectId);
      this.clients.set(projectId, client);
    }
    return client;
  }
}
