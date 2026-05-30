import type { FsTransport } from '../fs/transport';
import type { VaultStorage } from '../fs/vault-storage';
import { type Manifest, ManifestSchema } from '../spec/manifest';
import type { MenuData } from '../spec/menu';
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

  getTransport(projectId: string): FsTransport;

  readManifest(projectId: string): Promise<Manifest>;
  readMenu(projectId: string): Promise<MenuData>;
  writeMenu(projectId: string, menu: MenuData): Promise<void>;
}

export function createVaultService(storage: VaultStorage): VaultService {
  return new VaultServiceImpl(storage);
}

class VaultServiceImpl implements VaultService {
  private transports = new Map<string, FsTransport>();

  constructor(private storage: VaultStorage) {}

  async createVault(name: string): Promise<string> {
    const projectId = generateProjectId();
    await this.createVaultWithId(projectId, name);
    return projectId;
  }

  async createVaultWithId(projectId: string, name: string): Promise<void> {
    const transport = await this.storage.getTransport(projectId);
    this.transports.set(projectId, transport);
    await initVault(transport, projectId, name);
  }

  async deleteVault(projectId: string): Promise<void> {
    await this.storage.remove(projectId);
    this.transports.delete(projectId);
  }

  async listVaults(): Promise<VaultMeta[]> {
    const vaults: VaultMeta[] = [];
    const dirNames = await this.storage.list();

    for (const projectId of dirNames) {
      try {
        let transport = this.transports.get(projectId);
        if (!transport) {
          transport = await this.storage.getTransport(projectId);
          this.transports.set(projectId, transport);
        }
        const raw = await transport.read(metaPath('manifest'));
        const manifest = ManifestSchema.parse(JSON.parse(raw));
        vaults.push({ projectId: manifest.project_id, name: manifest.name });
      } catch {}
    }

    return vaults;
  }

  getTransport(projectId: string): FsTransport {
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

  private async getTransportOrThrow(projectId: string): Promise<FsTransport> {
    let transport = this.transports.get(projectId);
    if (!transport) {
      transport = await this.storage.getTransport(projectId);
      this.transports.set(projectId, transport);
    }
    return transport;
  }
}
