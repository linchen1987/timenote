import type { FsTransport } from '../fs/transport';
import type { VaultRegistry } from './vault-registry';
import { ManifestSchema } from '../spec/manifest';
import { generateProjectId } from '../spec/project-id';
import { metaPath } from '../spec/vault-layout';
import { initVault } from './vault-ops';

export interface VaultMeta {
  projectId: string;
  name: string;
}

export interface VaultService {
  createVault(name: string): Promise<string>;
  createVaultWithId(projectId: string, name: string): Promise<void>;
  deleteVault(projectId: string): Promise<void>;
  listVaults(): Promise<VaultMeta[]>;
  getTransport(projectId: string): Promise<FsTransport>;
}

export function createVaultService(registry: VaultRegistry): VaultService {
  return new VaultServiceImpl(registry);
}

class VaultServiceImpl implements VaultService {
  private transports = new Map<string, FsTransport>();

  constructor(private registry: VaultRegistry) {}

  async createVault(name: string): Promise<string> {
    const projectId = generateProjectId();
    await this.createVaultWithId(projectId, name);
    return projectId;
  }

  async createVaultWithId(projectId: string, name: string): Promise<void> {
    const transport = await this.registry.getTransport(projectId);
    this.transports.set(projectId, transport);
    await initVault(transport, projectId, name);
  }

  async deleteVault(projectId: string): Promise<void> {
    await this.registry.remove(projectId);
    this.transports.delete(projectId);
  }

  async listVaults(): Promise<VaultMeta[]> {
    const vaults: VaultMeta[] = [];
    const dirNames = await this.registry.list();

    for (const projectId of dirNames) {
      try {
        let transport = this.transports.get(projectId);
        if (!transport) {
          transport = await this.registry.getTransport(projectId);
          this.transports.set(projectId, transport);
        }
        const raw = await transport.read(metaPath('manifest'));
        const manifest = ManifestSchema.parse(JSON.parse(raw));
        vaults.push({ projectId: manifest.project_id, name: manifest.name });
      } catch {}
    }

    return vaults;
  }

  async getTransport(projectId: string): Promise<FsTransport> {
    let transport = this.transports.get(projectId);
    if (!transport) {
      transport = await this.storage.getTransport(projectId);
      this.transports.set(projectId, transport);
    }
    return transport;
  }
}
