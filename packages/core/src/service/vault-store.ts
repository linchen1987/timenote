import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { STORAGE_KEYS, SYNC_TTL_MS } from '../constants';
import {
  createMigrationService,
  type LegacyNotebookInfo,
  type MigrationProgress,
  type MigrationResult,
  type MigrationService,
} from '../migration/migration-service';
import { deleteVaultIndexDatabase } from '../provider/index-service';
import { type Manifest, ManifestSchema } from '../spec/manifest';
import type { RuntimeMenuItem } from '../spec/menu';
import { metaPath, noteFilePath } from '../spec/vault-layout';
import { createVaultExportService, type VaultExportService } from '../vault/export-service';
import {
  createVaultImportService,
  type ImportResult,
  type VaultImportService,
} from '../vault/import-service';
import {
  createPrefixedTransport,
  createVaultSyncService,
  type RemoteTransport,
  type SyncResult,
  toVaultFs,
  type VaultSyncService,
} from '../vault/sync-service';
import { createVaultService, type VaultMeta, type VaultService } from '../vault/vault-service';
import { createVaultMenuService, type VaultMenuService } from './menu-service';
import { createVaultNoteService, type VaultNoteService } from './note-service';

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

export type VaultStore = {
  vaultService: VaultService | null;
  noteService: VaultNoteService | null;
  menuService: VaultMenuService | null;
  syncService: VaultSyncService | null;
  exportService: VaultExportService | null;
  importService: VaultImportService | null;
  migrationService: MigrationService | null;
  menuItems: RuntimeMenuItem[];
  vaults: VaultMeta[];
  activeProjectId: string | null;
  isSyncing: boolean;
  lastSyncTime: string | null;
  noteVersion: number;
  needsMigration: boolean;
  legacyNotebooks: LegacyNotebookInfo[];
  migrationStatus: 'idle' | 'migrating' | 'done';
  migrationProgress: MigrationProgress | null;

  init: () => Promise<void>;
  listVaults: () => Promise<VaultMeta[]>;
  createVault: (name: string) => Promise<string>;
  deleteVault: (projectId: string) => Promise<void>;

  activateVault: (projectId: string) => Promise<void>;
  deactivateVault: () => void;

  getNoteService: () => VaultNoteService;

  loadMenu: (projectId: string) => Promise<void>;
  addMenuItem: (
    projectId: string,
    item: {
      parentId: string | null;
      title: string;
      type: 'note' | 'search';
      search?: string;
      note_id?: string;
    },
  ) => Promise<void>;
  updateMenuItem: (
    projectId: string,
    id: string,
    updates: { title: string; type: 'note' | 'search'; search?: string },
  ) => Promise<void>;
  deleteMenuItem: (projectId: string, id: string) => Promise<void>;
  reorderMenuItems: (
    projectId: string,
    updates: { id: string; order: number; parentId: string | null }[],
  ) => Promise<void>;

  getTagsWithCounts: () => Promise<{ name: string; count: number }[]>;

  listRemoteVaults: () => Promise<VaultMeta[]>;
  cloneVault: (projectId: string) => Promise<void>;

  sync: (projectId: string) => Promise<SyncResult>;
  pull: (projectId: string) => Promise<SyncResult>;
  push: (projectId: string) => Promise<SyncResult>;
  tryEntrySync: (projectId: string) => Promise<void>;

  notifyNoteChange: (
    projectId: string,
    noteId: string,
    action: 'create' | 'update' | 'delete',
  ) => void;
  scheduleAutoSync: (projectId: string) => void;

  exportVault: (projectId: string) => Promise<void>;
  importVault: (file: File) => Promise<ImportResult>;

  checkMigration: () => Promise<boolean>;
  listLegacyNotebooks: () => Promise<LegacyNotebookInfo[]>;
  migrateLegacyNotebook: (notebookId: string) => Promise<MigrationResult>;
  clearLegacyData: () => Promise<void>;
};

async function checkConfigured(
  transport: RemoteTransport | { isConfigured(): boolean | Promise<boolean> },
): Promise<boolean> {
  return transport.isConfigured();
}

export function createVaultStore(
  transport: RemoteTransport | { isConfigured(): boolean | Promise<boolean> },
) {
  const remoteTransport: RemoteTransport = {
    list: (path) => transport.list(path),
    read: (path) => transport.read(path),
    write: (path, content) => transport.write(path, content),
    exists: (path) => transport.exists(path),
    ensureDir: (path) => transport.ensureDir(path),
    remove: (path) => transport.remove(path),
    isConfigured: () => transport.isConfigured(),
  };

  const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function debounceSync(store: VaultStore, projectId: string): void {
    const existing = syncTimers.get(projectId);
    if (existing) clearTimeout(existing);
    syncTimers.set(
      projectId,
      setTimeout(() => {
        syncTimers.delete(projectId);
        if (!store.isSyncing) {
          store.sync(projectId).catch(() => {});
        }
      }, 1000),
    );
  }

  function getRemoteForProject(projectId: string): RemoteTransport {
    return createPrefixedTransport(`timenote/vaults/${projectId}`, remoteTransport);
  }

  const VAULTS_REMOTE_PREFIX = 'timenote/vaults';

  async function listRemoteVaults(): Promise<VaultMeta[]> {
    if (!(await checkConfigured(transport))) return [];
    try {
      const entries = await remoteTransport.list(VAULTS_REMOTE_PREFIX);
      const vaults: VaultMeta[] = [];
      for (const entry of entries) {
        if (entry.type !== 'directory') continue;
        const projectId = entry.basename;
        try {
          const manifestPath = `${VAULTS_REMOTE_PREFIX}/${projectId}/${metaPath('manifest')}`;
          const raw = await remoteTransport.read(manifestPath);
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

  return create<VaultStore>((set, get) => ({
    vaultService: null,
    noteService: null,
    menuService: null,
    syncService: null,
    exportService: null,
    importService: null,
    migrationService: null,
    menuItems: [],
    vaults: [],
    activeProjectId: null,
    isSyncing: false,
    lastSyncTime: null,
    noteVersion: 0,
    needsMigration: false,
    legacyNotebooks: [],
    migrationStatus: 'idle',
    migrationProgress: null,

    init: async () => {
      if (get().vaultService) return;
      const vaultService = await createVaultService();
      const noteService = createVaultNoteService(vaultService);
      const menuService = createVaultMenuService(vaultService);
      const syncService = createVaultSyncService(vaultService, noteService);
      const exportService = createVaultExportService(vaultService, syncService);
      const importService = createVaultImportService(vaultService, noteService, syncService);
      const migrationService = createMigrationService();
      set({
        vaultService,
        noteService,
        menuService,
        syncService,
        exportService,
        importService,
        migrationService,
      });
    },

    listVaults: async () => {
      await get().init();
      const vaults = (await get().vaultService?.listVaults()) ?? [];
      set({ vaults });
      return vaults;
    },

    createVault: async (name: string) => {
      await get().init();
      const id = (await get().vaultService?.createVault(name)) as string;
      await get().listVaults();
      return id;
    },

    deleteVault: async (projectId: string) => {
      await get().init();
      await get().vaultService?.deleteVault(projectId);
      await deleteVaultIndexDatabase(projectId);
      await get().listVaults();
    },

    activateVault: async (projectId: string) => {
      if (get().activeProjectId === projectId) return;
      await get().init();
      await get().vaultService?.listVaults();
      const noteService = get().noteService;
      if (noteService) {
        await noteService.activateVault(projectId);
      }
      set({ activeProjectId: projectId });
      await get().loadMenu(projectId);

      const syncService = get().syncService;
      if (syncService) {
        await syncService.loadLedgerCache(projectId);
      }
    },

    deactivateVault: () => {
      get().noteService?.deactivateVault();
      set({ activeProjectId: null, menuItems: [] });
    },

    getNoteService: () => {
      const svc = get().noteService;
      if (!svc) throw new Error('VaultNoteService not initialized');
      return svc;
    },

    loadMenu: async (projectId: string) => {
      const menuService = get().menuService;
      if (!menuService) return;
      try {
        const items = await menuService.loadMenu(projectId);
        set({ menuItems: items });
      } catch (e) {
        console.error('[loadMenu] failed:', e);
        set({ menuItems: [] });
      }
    },

    addMenuItem: async (projectId, item) => {
      const current = get().menuItems;
      const siblings = current.filter((i) => i.parentId === item.parentId);
      const newItem: RuntimeMenuItem = {
        id: nanoid(8),
        parentId: item.parentId,
        order: siblings.length,
        title: item.title,
        type: item.type,
        search: item.type === 'search' ? item.search : undefined,
        note_id: item.type === 'note' ? item.note_id : undefined,
      };
      const updated = [...current, newItem];
      await get().menuService?.saveMenu(projectId, updated);
      set({ menuItems: updated });
      get().syncService?.markDirty(projectId, [
        { type: 'meta', key: 'menu.json', action: 'upsert' },
      ]);
      get().scheduleAutoSync(projectId);
    },

    updateMenuItem: async (projectId, id, updates) => {
      const current = get().menuItems;
      const updated = current.map((item) =>
        item.id === id
          ? {
              ...item,
              title: updates.title,
              type: updates.type,
              search: updates.type === 'search' ? updates.search : undefined,
            }
          : item,
      );
      await get().menuService?.saveMenu(projectId, updated);
      set({ menuItems: updated });
      get().syncService?.markDirty(projectId, [
        { type: 'meta', key: 'menu.json', action: 'upsert' },
      ]);
      get().scheduleAutoSync(projectId);
    },

    deleteMenuItem: async (projectId, id) => {
      const current = get().menuItems;
      const idsToDelete = new Set<string>();
      const collectIds = (itemId: string) => {
        idsToDelete.add(itemId);
        for (const i of current) {
          if (i.parentId === itemId) collectIds(i.id);
        }
      };
      collectIds(id);
      const updated = current.filter((i) => !idsToDelete.has(i.id));
      await get().menuService?.saveMenu(projectId, updated);
      set({ menuItems: updated });
      get().syncService?.markDirty(projectId, [
        { type: 'meta', key: 'menu.json', action: 'upsert' },
      ]);
      get().scheduleAutoSync(projectId);
    },

    reorderMenuItems: async (projectId, updates) => {
      const current = get().menuItems;
      const updated = current.map((item) => {
        const u = updates.find((x) => x.id === item.id);
        return u ? { ...item, order: u.order, parentId: u.parentId } : item;
      });
      await get().menuService?.saveMenu(projectId, updated);
      set({ menuItems: updated });
      get().syncService?.markDirty(projectId, [
        { type: 'meta', key: 'menu.json', action: 'upsert' },
      ]);
      get().scheduleAutoSync(projectId);
    },

    getTagsWithCounts: async () => {
      const svc = get().noteService;
      if (!svc) return [];
      return svc.getTagsWithCounts();
    },

    notifyNoteChange: (
      projectId: string,
      noteId: string,
      action: 'create' | 'update' | 'delete',
    ) => {
      const syncService = get().syncService;
      if (!syncService) return;
      const path = noteFilePath(noteId);
      if (action === 'delete') {
        syncService.markDirty(projectId, [{ type: 'note', path, action: 'delete' }]);
      } else {
        syncService.markDirty(projectId, [{ type: 'note', path, action: 'upsert' }]);
      }
      get().scheduleAutoSync(projectId);
      set((s) => ({ noteVersion: s.noteVersion + 1 }));
    },

    scheduleAutoSync: (projectId: string) => {
      debounceSync(get(), projectId);
    },

    tryEntrySync: async (projectId: string) => {
      if (isSyncCacheValid(projectId)) return;
      if (!(await checkConfigured(transport))) return;
      try {
        await get().sync(projectId);
      } catch {}
    },

    sync: async (projectId: string) => {
      if (!(await checkConfigured(transport))) {
        throw new Error('Storage not configured. Please configure S3 or WebDAV settings.');
      }
      set({ isSyncing: true });
      try {
        const syncService = get().syncService;
        if (!syncService) throw new Error('SyncService not initialized');
        const remote = getRemoteForProject(projectId);
        const result = await syncService.sync(projectId, remote);
        set({ lastSyncTime: new Date().toISOString() });
        touchSyncCache(projectId);
        await get().loadMenu(projectId);
        return result;
      } finally {
        set({ isSyncing: false });
      }
    },

    pull: async (projectId: string) => {
      if (!(await checkConfigured(transport))) {
        throw new Error('Storage not configured');
      }
      set({ isSyncing: true });
      try {
        const syncService = get().syncService;
        if (!syncService) throw new Error('SyncService not initialized');
        const remote = getRemoteForProject(projectId);
        const result = await syncService.pull(projectId, remote);
        set({ lastSyncTime: new Date().toISOString() });
        touchSyncCache(projectId);
        await get().loadMenu(projectId);
        return result;
      } finally {
        set({ isSyncing: false });
      }
    },

    push: async (projectId: string) => {
      if (!(await checkConfigured(transport))) {
        throw new Error('Storage not configured');
      }
      set({ isSyncing: true });
      try {
        const syncService = get().syncService;
        if (!syncService) throw new Error('SyncService not initialized');
        const remote = getRemoteForProject(projectId);
        const result = await syncService.push(projectId, remote);
        set({ lastSyncTime: new Date().toISOString() });
        touchSyncCache(projectId);
        return result;
      } finally {
        set({ isSyncing: false });
      }
    },

    exportVault: async (projectId: string) => {
      const exportService = get().exportService;
      if (!exportService) throw new Error('ExportService not initialized');
      await exportService.downloadVault(projectId);
    },

    listRemoteVaults: async () => {
      await get().init();
      return listRemoteVaults();
    },

    cloneVault: async (projectId: string) => {
      if (!(await checkConfigured(transport))) {
        throw new Error('Storage not configured');
      }
      await get().init();
      const vaultService = get().vaultService;
      const syncService = get().syncService;
      if (!vaultService) throw new Error('VaultService not initialized');
      if (!syncService) throw new Error('SyncService not initialized');

      const remote = getRemoteForProject(projectId);
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

      await syncService.initFromSource(projectId, toVaultFs(remote), {
        writeSourceLedger: true,
      });
      await get().listVaults();
    },

    importVault: async (file: File) => {
      const importService = get().importService;
      if (!importService) throw new Error('ImportService not initialized');
      const result = await importService.importVault(file);
      await get().listVaults();
      return result;
    },

    checkMigration: async () => {
      await get().init();
      const svc = get().migrationService;
      if (!svc) return false;
      const needs = await svc.needsMigration();
      set({ needsMigration: needs });
      return needs;
    },

    listLegacyNotebooks: async () => {
      await get().init();
      const svc = get().migrationService;
      if (!svc) return [];
      const notebooks = await svc.listLegacyNotebooks();
      set({ legacyNotebooks: notebooks });
      return notebooks;
    },

    migrateLegacyNotebook: async (notebookId: string) => {
      const svc = get().migrationService;
      if (!svc) throw new Error('MigrationService not initialized');
      set({ migrationStatus: 'migrating' });
      try {
        const result = await svc.exportNotebook(notebookId, (p) => {
          set({ migrationProgress: p });
        });

        const url = URL.createObjectURL(result.zipBlob);
        const a = document.createElement('a');
        a.href = url;
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
        a.download = `${result.notebookName}_${ts}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        set({ migrationStatus: 'done' });
        return result;
      } catch (e) {
        set({ migrationStatus: 'idle' });
        throw e;
      }
    },

    clearLegacyData: async () => {
      const svc = get().migrationService;
      if (!svc) throw new Error('MigrationService not initialized');
      await svc.clearLegacyData();
      set({ needsMigration: false, legacyNotebooks: [] });
    },
  }));
}
