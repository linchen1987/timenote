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
  getProvider(projectId: string): Promise<FsClient>;
}

export function createVaultService(registry: VaultRegistry): VaultService {
  return new VaultServiceImpl(registry);
}

class VaultServiceImpl implements VaultService {
  private transports = new Map<string, FsClient>();

  constructor(private registry: VaultRegistry) {}

  async createVault(name: string): Promise<string> {
    const projectId = generateProjectId();
    await this.createVaultWithId(projectId, name);
    return projectId;
  }

  async createVaultWithId(projectId: string, name: string): Promise<void> {
    await this.registry.register(projectId, name);
    const transport = await this.registry.getProvider(projectId);
    this.transports.set(projectId, transport);
    await initVault(transport, projectId, name);
  }

  async deleteVault(projectId: string): Promise<void> {
    await this.registry.destroy(projectId);
    this.transports.delete(projectId);
  }

  async listVaults(): Promise<VaultMeta[]> {
    const vaults: VaultMeta[] = [];
    const entries = await this.registry.list();

    for (const entry of entries) {
      try {
        let transport = this.transports.get(entry.projectId);
        if (!transport) {
          transport = await this.registry.getProvider(entry.projectId);
          this.transports.set(entry.projectId, transport);
        }
        const raw = await transport.read(metaPath('manifest'));
        const manifest = ManifestSchema.parse(JSON.parse(raw));
        vaults.push({ projectId: manifest.project_id, name: manifest.name });
      } catch {}
    }

    return vaults;
  }

  async getProvider(projectId: string): Promise<FsClient> {
    let transport = this.transports.get(projectId);
    if (!transport) {
      transport = await this.registry.getProvider(projectId);
      this.transports.set(projectId, transport);
    }
    return transport;
  }
}
