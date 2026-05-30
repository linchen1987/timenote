import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { STORAGE_KEYS, SYNC_TTL_MS } from '../constants';
import { getProvider, type StorageProviderConfig as ProviderConfig } from '../fs/config/store';
import { createPrefixedTransport } from '../fs/prefixed';
import type { FsTransport } from '../fs/transport';
import type { VaultStorage } from '../fs/vault-storage';
import { type Manifest, ManifestSchema } from '../spec/manifest';
import type { RuntimeMenuItem } from '../spec/menu';
import { metaPath, noteFilePath } from '../spec/vault-layout';
import type { DirtyEntry } from '../vault/build-ledger';
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
import { deleteVaultIndexDatabase } from './index-service';
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

const VAULTS_REMOTE_PREFIX = 'timenote/vaults';
const DEFAULT_REMOTE_NAME = 'origin';

interface ResolvedTransport {
  transport: FsTransport;
  remoteName: string;
  providerId: string;
  path: string;
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

export type VaultStore = {
  vaultService: VaultService | null;
  noteService: VaultNoteService | null;
  menuService: VaultMenuService | null;
  syncService: VaultSyncService | null;
  exportService: VaultExportService | null;
  importService: VaultImportService | null;
  menuItems: RuntimeMenuItem[];
  vaults: VaultMeta[];
  activeProjectId: string | null;
  isSyncing: boolean;
  syncSuccess: boolean;
  lastSyncError: string | null;
  lastSyncTime: string | null;
  noteVersion: number;

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

  configureRemote: (projectId: string, providerId: string, path?: string) => void;
  removeRemote: (projectId: string, remoteName?: string) => void;
  toggleRemote: (projectId: string, remoteName?: string) => void;
  getRemoteConfig: (projectId: string, remoteName?: string) => RemoteEntry | null;

  listRemoteVaults: (providerId: string) => Promise<VaultMeta[]>;
  cloneVault: (projectId: string) => Promise<void>;
  cloneFromProvider: (providerId: string, path: string) => Promise<void>;

  sync: (projectId: string) => Promise<SyncResult>;
  pull: (projectId: string) => Promise<SyncResult>;
  push: (projectId: string) => Promise<SyncResult>;
  tryEntrySync: (projectId: string) => Promise<void>;

  notifyNoteChange: (
    projectId: string,
    noteId: string,
    action: 'create' | 'update' | 'delete',
    attachmentPaths?: string[],
  ) => void;
  scheduleAutoSync: (projectId: string) => void;

  exportVault: (projectId: string) => Promise<void>;
  importVault: (file: File) => Promise<ImportResult>;
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

const EMPTY_SYNC_RESULT: SyncResult = { pulled: 0, pushed: 0, conflicts: 0, errors: [] };

export function createVaultStore(
  createRemoteTransport: (provider: ProviderConfig) => FsTransport,
  createLocalStorage: () => Promise<VaultStorage>,
) {
  return create<VaultStore>((set, get) => ({
    vaultService: null,
    noteService: null,
    menuService: null,
    syncService: null,
    exportService: null,
    importService: null,
    menuItems: [],
    vaults: [],
    activeProjectId: null,
    isSyncing: false,
    syncSuccess: false,
    lastSyncError: null,
    lastSyncTime: null,
    noteVersion: 0,

    init: async () => {
      if (get().vaultService) return;
      const storage = await createLocalStorage();
      const vaultService = createVaultService(storage);
      const noteService = createVaultNoteService(vaultService);
      const menuService = createVaultMenuService(vaultService);
      const syncService = createVaultSyncService(vaultService, noteService);
      const exportService = createVaultExportService(vaultService, syncService);
      const importService = createVaultImportService(vaultService, noteService, syncService);
      set({
        vaultService,
        noteService,
        menuService,
        syncService,
        exportService,
        importService,
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
      removeRemoteConfig(projectId);
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

    configureRemote: (projectId: string, providerId: string, path?: string) => {
      setRemote(projectId, DEFAULT_REMOTE_NAME, {
        providerId,
        path: path ?? getDefaultRemotePath(projectId),
        enabled: true,
      });
    },

    removeRemote: (projectId: string, remoteName?: string) => {
      removeRemoteConfig(projectId, remoteName ?? DEFAULT_REMOTE_NAME);
    },

    toggleRemote: (projectId: string, remoteName?: string) => {
      const name = remoteName ?? DEFAULT_REMOTE_NAME;
      const entry = getRemote(projectId, name);
      if (entry) {
        setRemote(projectId, name, { ...entry, enabled: !entry.enabled });
      }
    },

    getRemoteConfig: (projectId: string, remoteName?: string) => {
      return getRemote(projectId, remoteName ?? DEFAULT_REMOTE_NAME) as RemoteEntry | null;
    },

    listRemoteVaults: async (providerId: string): Promise<VaultMeta[]> => {
      const provider = getProvider(providerId);
      if (!provider) return [];
      try {
        const transport = createRemoteTransport(provider);
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
    },

    cloneVault: async (projectId: string) => {
      await get().init();
      const vaultService = get().vaultService;
      const syncService = get().syncService;
      if (!vaultService) throw new Error('VaultService not initialized');
      if (!syncService) throw new Error('SyncService not initialized');

      const resolved = resolveTransport(projectId, createRemoteTransport);
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
      await get().listVaults();
    },

    cloneFromProvider: async (providerId: string, path: string) => {
      await get().init();
      const vaultService = get().vaultService;
      const syncService = get().syncService;
      if (!vaultService) throw new Error('VaultService not initialized');
      if (!syncService) throw new Error('SyncService not initialized');

      const provider = getProvider(providerId);
      if (!provider) throw new Error(`Provider not found: ${providerId}`);

      const transport = createPrefixedTransport(path, createRemoteTransport(provider));
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
      await get().listVaults();
    },

    notifyNoteChange: (
      projectId: string,
      noteId: string,
      action: 'create' | 'update' | 'delete',
      attachmentPaths?: string[],
    ) => {
      const syncService = get().syncService;
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
      get().scheduleAutoSync(projectId);
      set((s) => ({ noteVersion: s.noteVersion + 1 }));
    },

    scheduleAutoSync: (projectId: string) => {
      debounceSync(get(), projectId);
    },

    tryEntrySync: async (projectId: string) => {
      if (isSyncCacheValid(projectId)) return;
      const resolved = resolveTransport(projectId, createRemoteTransport);
      if (!resolved) return;
      try {
        await get().sync(projectId);
      } catch {}
    },

    sync: async (projectId: string) => {
      const resolved = resolveTransport(projectId, createRemoteTransport);
      if (!resolved) return EMPTY_SYNC_RESULT;
      set({ isSyncing: true, syncSuccess: false, lastSyncError: null });
      try {
        const syncService = get().syncService;
        if (!syncService) throw new Error('SyncService not initialized');
        const result = await syncService.sync(projectId, resolved.transport);
        set({ lastSyncTime: new Date().toISOString() });
        touchSyncCache(projectId);
        await get().loadMenu(projectId);
        if (result.pulled > 0) {
          set((s) => ({ noteVersion: s.noteVersion + 1 }));
        }
        const errorMsg = result.errors.length > 0 ? result.errors.join('; ') : null;
        set({ isSyncing: false, syncSuccess: result.errors.length === 0, lastSyncError: errorMsg });
        return result;
      } catch (e) {
        const msg = (e as Error).message;
        set({ isSyncing: false, syncSuccess: false, lastSyncError: msg });
        throw e;
      }
    },

    pull: async (projectId: string) => {
      const resolved = resolveTransport(projectId, createRemoteTransport);
      if (!resolved) return EMPTY_SYNC_RESULT;
      set({ isSyncing: true, syncSuccess: false, lastSyncError: null });
      try {
        const syncService = get().syncService;
        if (!syncService) throw new Error('SyncService not initialized');
        const result = await syncService.pull(projectId, resolved.transport);
        set({ lastSyncTime: new Date().toISOString() });
        touchSyncCache(projectId);
        await get().loadMenu(projectId);
        if (result.pulled > 0) {
          set((s) => ({ noteVersion: s.noteVersion + 1 }));
        }
        const errorMsg = result.errors.length > 0 ? result.errors.join('; ') : null;
        set({ isSyncing: false, syncSuccess: result.errors.length === 0, lastSyncError: errorMsg });
        return result;
      } catch (e) {
        const msg = (e as Error).message;
        set({ isSyncing: false, syncSuccess: false, lastSyncError: msg });
        throw e;
      }
    },

    push: async (projectId: string) => {
      const resolved = resolveTransport(projectId, createRemoteTransport);
      if (!resolved) return EMPTY_SYNC_RESULT;
      set({ isSyncing: true, syncSuccess: false, lastSyncError: null });
      try {
        const syncService = get().syncService;
        if (!syncService) throw new Error('SyncService not initialized');
        const result = await syncService.push(projectId, resolved.transport);
        set({ lastSyncTime: new Date().toISOString() });
        touchSyncCache(projectId);
        const errorMsg = result.errors.length > 0 ? result.errors.join('; ') : null;
        set({ isSyncing: false, syncSuccess: result.errors.length === 0, lastSyncError: errorMsg });
        return result;
      } catch (e) {
        const msg = (e as Error).message;
        set({ isSyncing: false, syncSuccess: false, lastSyncError: msg });
        throw e;
      }
    },

    exportVault: async (projectId: string) => {
      const exportService = get().exportService;
      if (!exportService) throw new Error('ExportService not initialized');
      await exportService.downloadVault(projectId);
    },

    importVault: async (file: File) => {
      const importService = get().importService;
      if (!importService) throw new Error('ImportService not initialized');
      const result = await importService.importVault(file);
      await get().listVaults();
      return result;
    },
  }));
}
