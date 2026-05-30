import type { FsTransport } from '../fs/transport';
import { createOpfsTransport, type OpfsTransport } from '../fs/opfs';
import { type Manifest, ManifestSchema } from '../spec/manifest';
import { createMenuData, type MenuData } from '../spec/menu';
import { generateProjectId } from '../spec/project-id';
import { metaPath } from '../spec/vault-layout';
import { initVault } from './vault-ops';

export interface VaultTransport extends OpfsTransport {}

const VAULTS_DIR = 'vaults';

export interface VaultMeta {
  projectId: string;
  name: string;
}

export interface VaultService {
  createVault(name: string): Promise<string>;
  createVaultWithId(projectId: string, name: string): Promise<void>;
  deleteVault(projectId: string): Promise<void>;
  listVaults(): Promise<VaultMeta[]>;

  getTransport(projectId: string): VaultTransport;

  readManifest(projectId: string): Promise<Manifest>;
  readMenu(projectId: string): Promise<MenuData>;
  writeMenu(projectId: string, menu: MenuData): Promise<void>;
}

export async function createVaultService(): Promise<VaultService> {
  const opfsRoot = await navigator.storage.getDirectory();
  const vaultsDir = await opfsRoot.getDirectoryHandle(VAULTS_DIR, { create: true });
  return new VaultServiceImpl(vaultsDir);
}

class VaultServiceImpl implements VaultService {
  private transports = new Map<string, VaultTransport>();

  constructor(private vaultsDir: FileSystemDirectoryHandle) {}

  async createVault(name: string): Promise<string> {
    const projectId = generateProjectId();
    await this.createVaultWithId(projectId, name);
    return projectId;
  }

  async createVaultWithId(projectId: string, name: string): Promise<void> {
    const vaultDir = await this.vaultsDir.getDirectoryHandle(projectId, { create: true });
    const transport = createOpfsTransport(vaultDir);
    this.transports.set(projectId, transport);
    await initVault(transport, projectId, name);
  }

  async deleteVault(projectId: string): Promise<void> {
    await this.vaultsDir.removeEntry(projectId, { recursive: true });
    this.transports.delete(projectId);
  }

  async listVaults(): Promise<VaultMeta[]> {
    const vaults: VaultMeta[] = [];

    for await (const [_name, handle] of this.vaultsDir.entries()) {
      if (handle.kind !== 'directory') continue;
      try {
        const transport = createOpfsTransport(handle);
        const raw = await transport.read(metaPath('manifest'));
        const manifest = ManifestSchema.parse(JSON.parse(raw));
        this.transports.set(manifest.project_id, transport);
        vaults.push({ projectId: manifest.project_id, name: manifest.name });
      } catch {}
    }

    return vaults;
  }

  getTransport(projectId: string): VaultTransport {
    const transport = this.transports.get(projectId);
    if (!transport) {
      throw new Error(
        `Vault ${projectId} not found in cache. Use listVaults or createVault first.`,
      );
    }
    return transport;
  }

  async readManifest(projectId: string): Promise<Manifest> {
    const transport = await this.getTransportOrThrow(projectId);
    const raw = await transport.read(metaPath('manifest'));
    return ManifestSchema.parse(JSON.parse(raw));
  }

  async readMenu(projectId: string): Promise<MenuData> {
    const transport = await this.getTransportOrThrow(projectId);
    const raw = await transport.read(metaPath('menu'));
    return JSON.parse(raw) as MenuData;
  }

  async writeMenu(projectId: string, menu: MenuData): Promise<void> {
    const transport = await this.getTransportOrThrow(projectId);
    menu.updated_at = new Date().toISOString();
    await transport.write(metaPath('menu'), JSON.stringify(menu, null, 2));
  }

  private async getTransportOrThrow(projectId: string): Promise<VaultTransport> {
    let transport = this.transports.get(projectId);
    if (!transport) {
      const vaultDir = await this.vaultsDir.getDirectoryHandle(projectId);
      transport = createOpfsTransport(vaultDir);
      this.transports.set(projectId, transport);
    }
    return transport;
  }
}
