import { nanoid } from 'nanoid';
import { STORAGE_KEYS, SYNC_TTL_MS } from '../constants';
import { getProvider, type StorageProviderConfig as ProviderConfig } from '../fs/config/store';
import { createPrefixedTransport } from '../fs/prefixed';
import type { FsTransport } from '../fs/transport';
import type { VaultStorage } from '../fs/vault-storage';
import { deleteVaultIndexDatabase } from '../notes/index-service';

import { createVaultMenuService, type VaultMenuService } from '../notes/menu-service';

import { createVaultNoteService, type VaultNoteService } from '../notes/note-service';
import { type Manifest, ManifestSchema } from '../spec/manifest';
import type { RuntimeMenuItem } from '../spec/menu';
import { metaPath, noteFilePath } from '../spec/vault-layout';
import type { DirtyEntry } from '../vault/build-ledger';
import { appendDeleteLog } from '../vault/vault-ops';
import { createVaultExportService, type VaultExportService } from '../vault/export-service';
import {
  createVaultImportService,
  type ImportResult,
  type VaultImportService,
} from '../vault/import-service';
import {
  getDefaultRemotePath,
  getEnabledRemotes,
  getRemote,
  type RemoteEntry,
  removeRemote as removeRemoteConfig,
  setRemote,
} from '../vault/notebook-remotes';
import {
  createVaultSyncService,
  type SyncResult,
  type VaultSyncService,
} from '../vault/sync-service';
import { createVaultService, type VaultMeta, type VaultService } from '../vault/vault-service';

const VAULTS_REMOTE_PREFIX = 'timenote/vaults';
const DEFAULT_REMOTE_NAME = 'origin';
const EMPTY_SYNC_RESULT: SyncResult = { pulled: 0, pushed: 0, conflicts: 0, errors: [] };

export interface MenuItemInput {
  parentId: string | null;
  title: string;
  type: 'note' | 'search';
  search?: string;
  note_id?: string;
}

export interface MenuItemUpdate {
  title: string;
  type: 'note' | 'search';
  search?: string;
}

export interface ReorderUpdate {
  id: string;
  order: number;
  parentId: string | null;
}

export interface SyncOutcome {
  result: SyncResult;
  menuItems: RuntimeMenuItem[];
  noteChanged: boolean;
}

interface ResolvedTransport {
  transport: FsTransport;
  remoteName: string;
  providerId: string;
  path: string;
}

function syncCacheKey(projectId: string): string {
  return `${STORAGE_KEYS.SYNC_CACHE_PREFIX}/${projectId}`;
}

function getSyncCacheTime(projectId: string): number | null {
  try {
    const raw = sessionStorage.getItem(syncCacheKey(projectId));
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function touchSyncCache(projectId: string): void {
  try {
    sessionStorage.setItem(syncCacheKey(projectId), String(Date.now()));
  } catch {}
}

function isSyncCacheValid(projectId: string): boolean {
  const ts = getSyncCacheTime(projectId);
  return ts !== null && Date.now() - ts < SYNC_TTL_MS;
}

function resolveTransport(
  projectId: string,
  createRemoteTransport: (provider: ProviderConfig) => FsTransport,
): ResolvedTransport | null {
  const enabledRemotes = getEnabledRemotes(projectId);
  const remoteNames = Object.keys(enabledRemotes);
  const remoteName = remoteNames[0];
  if (!remoteName) return null;

  const entry = getRemote(projectId, remoteName);
  if (!entry || !entry.enabled) return null;

  const provider = getProvider(entry.providerId);
  if (!provider) return null;

  const transport = createRemoteTransport(provider);
  const prefixed = createPrefixedTransport(entry.path, transport);
  return { transport: prefixed, remoteName, providerId: provider.id, path: entry.path };
}

export class VaultOrchestrator {
  private vaultService: VaultService | null = null;
  private noteService: VaultNoteService | null = null;
  private menuService: VaultMenuService | null = null;
  private syncService: VaultSyncService | null = null;
  private exportService: VaultExportService | null = null;
  private importService: VaultImportService | null = null;
  private initialized = false;

  constructor(
    private readonly createRemoteTransport: (provider: ProviderConfig) => FsTransport,
    private readonly createLocalStorage: () => Promise<VaultStorage>,
  ) {}

  async init(): Promise<void> {
    if (this.initialized) return;
    const storage = await this.createLocalStorage();
    this.vaultService = createVaultService(storage);
    this.noteService = createVaultNoteService(this.vaultService, {
      onDeleteNote: async (projectId, noteId) => {
        const transport = await this.vaultService!.getTransport(projectId);
        await appendDeleteLog(transport, noteId);
      },
    });
    this.menuService = createVaultMenuService(this.vaultService);
    this.syncService = createVaultSyncService(this.vaultService, {
      onPullComplete: (projectId) => this.noteService!.rebuildIndex(projectId),
    });
    this.exportService = createVaultExportService(this.vaultService, this.syncService);
    this.importService = createVaultImportService(
      this.vaultService,
      this.syncService,
    );
    this.initialized = true;
  }

  private requireVaultService(): VaultService {
    if (!this.vaultService) throw new Error('VaultService not initialized. Call init() first.');
    return this.vaultService;
  }

  private requireNoteService(): VaultNoteService {
    if (!this.noteService) throw new Error('NoteService not initialized. Call init() first.');
    return this.noteService;
  }

  private requireSyncService(): VaultSyncService {
    if (!this.syncService) throw new Error('SyncService not initialized. Call init() first.');
    return this.syncService;
  }

  private requireMenuService(): VaultMenuService {
    if (!this.menuService) throw new Error('MenuService not initialized. Call init() first.');
    return this.menuService;
  }

  getNoteService(): VaultNoteService {
    return this.requireNoteService();
  }

  async listVaults(): Promise<VaultMeta[]> {
    await this.init();
    return this.requireVaultService().listVaults();
  }

  async createVault(name: string): Promise<string> {
    await this.init();
    const id = await this.requireVaultService().createVault(name);
    return id;
  }

  async deleteVault(projectId: string): Promise<void> {
    await this.init();
    await this.requireVaultService().deleteVault(projectId);
    await deleteVaultIndexDatabase(projectId);
    removeRemoteConfig(projectId);
  }

  async activateVault(projectId: string): Promise<void> {
    await this.init();
    await this.requireVaultService().listVaults();
    await this.requireNoteService().activateVault(projectId);
    await this.requireSyncService().loadLedgerCache(projectId);
  }

  deactivateVault(): void {
    this.noteService?.deactivateVault();
  }

  async loadMenu(projectId: string): Promise<RuntimeMenuItem[]> {
    try {
      return await this.requireMenuService().loadMenu(projectId);
    } catch (e) {
      console.error('[loadMenu] failed:', e);
      return [];
    }
  }

  private async saveMenuAndSync(projectId: string, items: RuntimeMenuItem[]): Promise<void> {
    await this.requireMenuService().saveMenu(projectId, items);
    this.requireSyncService().markDirty(projectId, [
      { type: 'meta', key: 'menu.json', action: 'upsert' },
    ]);
  }

  async addMenuItem(
    projectId: string,
    currentItems: RuntimeMenuItem[],
    item: MenuItemInput,
  ): Promise<RuntimeMenuItem[]> {
    const siblings = currentItems.filter((i) => i.parentId === item.parentId);
    const newItem: RuntimeMenuItem = {
      id: nanoid(8),
      parentId: item.parentId,
      order: siblings.length,
      title: item.title,
      type: item.type,
      search: item.type === 'search' ? item.search : undefined,
      note_id: item.type === 'note' ? item.note_id : undefined,
    };
    const updated = [...currentItems, newItem];
    await this.saveMenuAndSync(projectId, updated);
    return updated;
  }

  async updateMenuItem(
    projectId: string,
    currentItems: RuntimeMenuItem[],
    id: string,
    updates: MenuItemUpdate,
  ): Promise<RuntimeMenuItem[]> {
    const updated = currentItems.map((item) =>
      item.id === id
        ? {
            ...item,
            title: updates.title,
            type: updates.type,
            search: updates.type === 'search' ? updates.search : undefined,
          }
        : item,
    );
    await this.saveMenuAndSync(projectId, updated);
    return updated;
  }

  async deleteMenuItem(
    projectId: string,
    currentItems: RuntimeMenuItem[],
    id: string,
  ): Promise<RuntimeMenuItem[]> {
    const idsToDelete = new Set<string>();
    const collectIds = (itemId: string) => {
      idsToDelete.add(itemId);
      for (const i of currentItems) {
        if (i.parentId === itemId) collectIds(i.id);
      }
    };
    collectIds(id);
    const updated = currentItems.filter((i) => !idsToDelete.has(i.id));
    await this.saveMenuAndSync(projectId, updated);
    return updated;
  }

  async reorderMenuItems(
    projectId: string,
    currentItems: RuntimeMenuItem[],
    updates: ReorderUpdate[],
  ): Promise<RuntimeMenuItem[]> {
    const updated = currentItems.map((item) => {
      const u = updates.find((x) => x.id === item.id);
      return u ? { ...item, order: u.order, parentId: u.parentId } : item;
    });
    await this.saveMenuAndSync(projectId, updated);
    return updated;
  }

  async getTagsWithCounts(): Promise<{ name: string; count: number }[]> {
    const svc = this.noteService;
    if (!svc) return [];
    return svc.getTagsWithCounts();
  }

  configureRemote(projectId: string, providerId: string, path?: string): void {
    setRemote(projectId, DEFAULT_REMOTE_NAME, {
      providerId,
      path: path ?? getDefaultRemotePath(projectId),
      enabled: true,
    });
  }

  removeRemote(projectId: string, remoteName?: string): void {
    removeRemoteConfig(projectId, remoteName ?? DEFAULT_REMOTE_NAME);
  }

  toggleRemote(projectId: string, remoteName?: string): void {
    const name = remoteName ?? DEFAULT_REMOTE_NAME;
    const entry = getRemote(projectId, name);
    if (entry) {
      setRemote(projectId, name, { ...entry, enabled: !entry.enabled });
    }
  }

  getRemoteConfig(projectId: string, remoteName?: string): RemoteEntry | null {
    return getRemote(projectId, remoteName ?? DEFAULT_REMOTE_NAME) as RemoteEntry | null;
  }

  async listRemoteVaults(providerId: string): Promise<VaultMeta[]> {
    const provider = getProvider(providerId);
    if (!provider) return [];
    try {
      const transport = this.createRemoteTransport(provider);
      const entries = await transport.list(VAULTS_REMOTE_PREFIX);
      const vaults: VaultMeta[] = [];
      for (const entry of entries) {
        if (entry.type !== 'directory') continue;
        const projectId = entry.basename;
        try {
          const manifestPath = `${VAULTS_REMOTE_PREFIX}/${projectId}/${metaPath('manifest')}`;
          const raw = await transport.read(manifestPath);
          const manifest: Manifest = ManifestSchema.parse(JSON.parse(raw));
          vaults.push({ projectId: manifest.project_id, name: manifest.name });
        } catch {
          vaults.push({ projectId, name: projectId });
        }
      }
      return vaults;
    } catch {
      return [];
    }
  }

  async cloneVault(projectId: string): Promise<void> {
    await this.init();
    const vaultService = this.requireVaultService();
    const syncService = this.requireSyncService();

    const resolved = resolveTransport(projectId, this.createRemoteTransport);
    if (!resolved) throw new Error('No remote configured for this notebook');

    const remote = resolved.transport;
    let manifest: Manifest;
    try {
      const raw = await remote.read(metaPath('manifest'));
      manifest = ManifestSchema.parse(JSON.parse(raw));
    } catch {
      throw new Error('Remote vault manifest not found');
    }

    const existing = await vaultService.listVaults();
    if (!existing.find((v) => v.projectId === projectId)) {
      await vaultService.createVaultWithId(projectId, manifest.name);
    }

    await syncService.initFromSource(projectId, remote, {
      writeSourceLedger: true,
    });
  }

  async cloneFromProvider(providerId: string, path: string): Promise<string> {
    await this.init();
    const vaultService = this.requireVaultService();
    const syncService = this.requireSyncService();

    const provider = getProvider(providerId);
    if (!provider) throw new Error(`Provider not found: ${providerId}`);

    const transport = createPrefixedTransport(path, this.createRemoteTransport(provider));
    let manifest: Manifest;
    try {
      const raw = await transport.read(metaPath('manifest'));
      manifest = ManifestSchema.parse(JSON.parse(raw));
    } catch {
      throw new Error('Remote vault manifest not found');
    }

    const projectId = manifest.project_id;
    const existing = await vaultService.listVaults();
    if (!existing.find((v) => v.projectId === projectId)) {
      await vaultService.createVaultWithId(projectId, manifest.name);
    }

    setRemote(projectId, DEFAULT_REMOTE_NAME, {
      providerId,
      path,
      enabled: true,
    });

    await syncService.initFromSource(projectId, transport, {
      writeSourceLedger: true,
    });

    return projectId;
  }

  notifyNoteChange(
    projectId: string,
    noteId: string,
    action: 'create' | 'update' | 'delete',
    attachmentPaths?: string[],
  ): void {
    const syncService = this.syncService;
    if (!syncService) return;
    const path = noteFilePath(noteId);
    const dirtyEntries: DirtyEntry[] = [];
    if (action === 'delete') {
      dirtyEntries.push({ type: 'note', path, action: 'delete' });
      if (attachmentPaths) {
        for (const ap of attachmentPaths) {
          dirtyEntries.push({ type: 'attachment', path: ap, action: 'delete' });
        }
      }
    } else {
      dirtyEntries.push({ type: 'note', path, action: 'upsert' });
      if (attachmentPaths) {
        for (const ap of attachmentPaths) {
          dirtyEntries.push({ type: 'attachment', path: ap, action: 'upsert' });
        }
      }
    }
    syncService.markDirty(projectId, dirtyEntries);
  }

  scheduleAutoSync(_projectId: string): void {
    // No-op: debounce + actual sync trigger is handled by the store layer
  }

  async tryEntrySync(projectId: string): Promise<SyncOutcome | null> {
    if (isSyncCacheValid(projectId)) return null;
    const resolved = resolveTransport(projectId, this.createRemoteTransport);
    if (!resolved) return null;
    try {
      return await this.sync(projectId);
    } catch {
      return null;
    }
  }

  private async executeSync(
    projectId: string,
    direction: 'sync' | 'pull' | 'push',
  ): Promise<SyncOutcome> {
    const resolved = resolveTransport(projectId, this.createRemoteTransport);
    if (!resolved) {
      return { result: EMPTY_SYNC_RESULT, menuItems: [], noteChanged: false };
    }

    const syncService = this.requireSyncService();
    let result: SyncResult;
    switch (direction) {
      case 'sync':
        result = await syncService.sync(projectId, resolved.transport);
        break;
      case 'pull':
        result = await syncService.pull(projectId, resolved.transport);
        break;
      case 'push':
        result = await syncService.push(projectId, resolved.transport);
        break;
    }

    touchSyncCache(projectId);

    const noteChanged = result.pulled > 0;
    let menuItems: RuntimeMenuItem[] = [];
    if (direction !== 'push') {
      menuItems = await this.loadMenu(projectId);
    }

    return { result, menuItems, noteChanged };
  }

  async sync(projectId: string): Promise<SyncOutcome> {
    await this.init();
    return this.executeSync(projectId, 'sync');
  }

  async pull(projectId: string): Promise<SyncOutcome> {
    await this.init();
    return this.executeSync(projectId, 'pull');
  }

  async push(projectId: string): Promise<SyncOutcome> {
    await this.init();
    return this.executeSync(projectId, 'push');
  }

  async exportVault(projectId: string): Promise<void> {
    await this.init();
    const exportService = this.exportService;
    if (!exportService) throw new Error('ExportService not initialized');
    await exportService.downloadVault(projectId);
  }

  async importVault(file: File): Promise<ImportResult> {
    await this.init();
    const importService = this.importService;
    if (!importService) throw new Error('ImportService not initialized');
    return importService.importVault(file);
  }
}
