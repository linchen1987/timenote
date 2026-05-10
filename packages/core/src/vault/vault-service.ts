import { createOpfsTransport, type OpfsTransport } from '../provider/opfs-transport';
import { createEmptyDeleteLog, type DeleteLog, DeleteLogSchema } from '../spec/delete-log';
import { createManifest, type Manifest, ManifestSchema } from '../spec/manifest';
import { createMenuData, type MenuData } from '../spec/menu';
import { generateProjectId } from '../spec/project-id';
import { createEmptySyncLedger } from '../spec/sync-ledger';
import { META_DIR, metaPath } from '../spec/vault-layout';

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
  readDeleteLog(projectId: string): Promise<DeleteLog>;
  appendDeleteLog(projectId: string, noteId: string): Promise<void>;
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
    await this.initVault(projectId, name);
    return projectId;
  }

  async createVaultWithId(projectId: string, name: string): Promise<void> {
    await this.initVault(projectId, name);
  }

  private async initVault(projectId: string, name: string): Promise<void> {
    const vaultDir = await this.vaultsDir.getDirectoryHandle(projectId, { create: true });
    const transport = createOpfsTransport(vaultDir);
    this.transports.set(projectId, transport);

    const now = new Date().toISOString();
    const manifest = createManifest({
      project_id: projectId,
      name,
      created_at: now,
      updated_at: now,
    });

    await transport.ensureDir(META_DIR);
    await transport.write(metaPath('manifest'), JSON.stringify(manifest, null, 2));
    await transport.write(metaPath('menu'), JSON.stringify(createMenuData([], now), null, 2));
    await transport.write(
      metaPath('deleteLog'),
      JSON.stringify(createEmptyDeleteLog(now), null, 2),
    );
    await transport.write(metaPath('syncLedger'), JSON.stringify(createEmptySyncLedger(), null, 2));
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
      } catch {
        // skip invalid vault directories
      }
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

  async readDeleteLog(projectId: string): Promise<DeleteLog> {
    const transport = await this.getTransportOrThrow(projectId);
    const raw = await transport.read(metaPath('deleteLog'));
    return DeleteLogSchema.parse(JSON.parse(raw));
  }

  async appendDeleteLog(projectId: string, noteId: string): Promise<void> {
    const log = await this.readDeleteLog(projectId);
    const now = new Date().toISOString();
    log.records[noteId] = now;
    log.updated_at = now;
    const transport = await this.getTransportOrThrow(projectId);
    await transport.write(metaPath('deleteLog'), JSON.stringify(log, null, 2));
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
