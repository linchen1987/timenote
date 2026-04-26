import { generateProjectId } from './note-id';
import { createOpfsTransport, type OpfsTransport } from './opfs-transport';
import {
  type DeleteLog,
  DeleteLogSchema,
  type Manifest,
  ManifestSchema,
  type MenuData,
  type SyncLedger,
} from './types';

const VAULTS_DIR = 'vaults';
const TIMENOTE_DIR = '.timenote';
const MANIFEST_FILE = 'manifest.json';
const MENU_FILE = 'menu.json';
const DELETE_LOG_FILE = 'delete-log.json';
const SYNC_LEDGER_FILE = 'sync-ledger.json';

export interface VaultMeta {
  projectId: string;
  name: string;
}

export interface VaultService {
  createVault(name: string): Promise<string>;
  deleteVault(projectId: string): Promise<void>;
  listVaults(): Promise<VaultMeta[]>;

  getOpfsTransport(projectId: string): OpfsTransport;

  readManifest(projectId: string): Promise<Manifest>;
  readMenu(projectId: string): Promise<MenuData>;
  writeMenu(projectId: string, menu: MenuData): Promise<void>;
  readDeleteLog(projectId: string): Promise<DeleteLog>;
  appendDeleteLog(projectId: string, noteId: string): Promise<void>;
  readSyncLedger(projectId: string): Promise<SyncLedger>;
  writeSyncLedger(projectId: string, ledger: SyncLedger): Promise<void>;
}

export async function createVaultService(): Promise<VaultService> {
  const opfsRoot = await navigator.storage.getDirectory();
  const vaultsDir = await opfsRoot.getDirectoryHandle(VAULTS_DIR, { create: true });
  return new VaultServiceImpl(vaultsDir);
}

class VaultServiceImpl implements VaultService {
  private transports = new Map<string, OpfsTransport>();

  constructor(private vaultsDir: FileSystemDirectoryHandle) {}

  async createVault(name: string): Promise<string> {
    const projectId = generateProjectId();
    const vaultDir = await this.vaultsDir.getDirectoryHandle(projectId, { create: true });
    const transport = createOpfsTransport(vaultDir);
    this.transports.set(projectId, transport);

    const now = new Date().toISOString();
    const manifest: Manifest = {
      project_id: projectId,
      name,
      version: '1.0.0',
      created_at: now,
      updated_at: now,
    };

    await transport.ensureDir(TIMENOTE_DIR);
    await transport.write(`${TIMENOTE_DIR}/${MANIFEST_FILE}`, JSON.stringify(manifest, null, 2));
    await transport.write(
      `${TIMENOTE_DIR}/${MENU_FILE}`,
      JSON.stringify({ version: 1, items: [] }, null, 2),
    );
    await transport.write(
      `${TIMENOTE_DIR}/${DELETE_LOG_FILE}`,
      JSON.stringify({ version: 1, records: {} }, null, 2),
    );
    await transport.write(
      `${TIMENOTE_DIR}/${SYNC_LEDGER_FILE}`,
      JSON.stringify({ version: 1, last_sync_time: now, entities: {}, meta_files: {} }, null, 2),
    );

    return projectId;
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
        const raw = await transport.read(`${TIMENOTE_DIR}/${MANIFEST_FILE}`);
        const manifest = ManifestSchema.parse(JSON.parse(raw));
        this.transports.set(manifest.project_id, transport);
        vaults.push({ projectId: manifest.project_id, name: manifest.name });
      } catch {
        // skip invalid vault directories
      }
    }

    return vaults;
  }

  getOpfsTransport(projectId: string): OpfsTransport {
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
    const raw = await transport.read(`${TIMENOTE_DIR}/${MANIFEST_FILE}`);
    return ManifestSchema.parse(JSON.parse(raw));
  }

  async readMenu(projectId: string): Promise<MenuData> {
    const transport = await this.getTransportOrThrow(projectId);
    const raw = await transport.read(`${TIMENOTE_DIR}/${MENU_FILE}`);
    return JSON.parse(raw) as MenuData;
  }

  async writeMenu(projectId: string, menu: MenuData): Promise<void> {
    const transport = await this.getTransportOrThrow(projectId);
    await transport.write(`${TIMENOTE_DIR}/${MENU_FILE}`, JSON.stringify(menu, null, 2));
  }

  async readDeleteLog(projectId: string): Promise<DeleteLog> {
    const transport = await this.getTransportOrThrow(projectId);
    const raw = await transport.read(`${TIMENOTE_DIR}/${DELETE_LOG_FILE}`);
    return DeleteLogSchema.parse(JSON.parse(raw));
  }

  async appendDeleteLog(projectId: string, noteId: string): Promise<void> {
    const log = await this.readDeleteLog(projectId);
    log.records[noteId] = new Date().toISOString();
    const transport = await this.getTransportOrThrow(projectId);
    await transport.write(`${TIMENOTE_DIR}/${DELETE_LOG_FILE}`, JSON.stringify(log, null, 2));
  }

  async readSyncLedger(projectId: string): Promise<SyncLedger> {
    const transport = await this.getTransportOrThrow(projectId);
    const raw = await transport.read(`${TIMENOTE_DIR}/${SYNC_LEDGER_FILE}`);
    return JSON.parse(raw) as SyncLedger;
  }

  async writeSyncLedger(projectId: string, ledger: SyncLedger): Promise<void> {
    const transport = await this.getTransportOrThrow(projectId);
    await transport.write(`${TIMENOTE_DIR}/${SYNC_LEDGER_FILE}`, JSON.stringify(ledger, null, 2));
  }

  private async getTransportOrThrow(projectId: string): Promise<OpfsTransport> {
    let transport = this.transports.get(projectId);
    if (!transport) {
      const vaultDir = await this.vaultsDir.getDirectoryHandle(projectId);
      transport = createOpfsTransport(vaultDir);
      this.transports.set(projectId, transport);
    }
    return transport;
  }
}
