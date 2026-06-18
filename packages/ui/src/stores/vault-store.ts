import type {
  FsVolumeAccess,
  ImportResult,
  LogEntry,
  RemoteConfig,
  RuntimeMenuItem,
  SyncResult,
  VaultMeta,
  VaultNoteService,
  VaultOrchestrator,
} from '@timenote/core';
import { create } from 'zustand';

type VolumeAccessEntry = FsVolumeAccess & { volumeUrl: string };

export type VaultStore = {
  vaultService: null;
  noteService: null;
  menuService: null;
  syncService: null;
  exportService: null;
  importService: null;
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

  configureRemote: (projectId: string, providerId: string, path?: string) => Promise<void>;
  removeRemote: (projectId: string, remoteName?: string) => Promise<void>;
  toggleRemote: (projectId: string, remoteName?: string) => Promise<void>;
  getRemoteConfig: (projectId: string, remoteName?: string) => Promise<RemoteConfig | null>;

  listRemoteVaults: (providerId: string) => Promise<VaultMeta[]>;
  cloneVault: (projectId: string) => Promise<void>;
  cloneFromProvider: (providerId: string, path: string, options?: { localPath?: string }) => Promise<void>;

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

  rebuildIndex: (projectId: string) => Promise<void>;
  rebuildLedger: (projectId: string) => Promise<void>;
  exportVault: (projectId: string) => Promise<void>;
  importVault: (file: File) => Promise<ImportResult>;

  getLoggingEnabled: (projectId: string) => Promise<boolean>;
  setLoggingEnabled: (projectId: string, enabled: boolean) => Promise<void>;
  readLogs: (projectId: string) => Promise<LogEntry[]>;
  clearLogs: (projectId: string) => Promise<void>;

  listVolumeAccesses: () => VolumeAccessEntry[];
  saveVolumeAccess: (access: FsVolumeAccess) => VolumeAccessEntry;
  deleteVolumeAccess: (volumeUrl: string) => void;
};

import { migrateRemotesFromLocalStorage } from '../lib/remote-config-migration';

export function createBoundVaultStore(orchestrator: VaultOrchestrator) {
  const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
      await orchestrator.init();
      try {
        await migrateRemotesFromLocalStorage(
          (projectId) => orchestrator.getLocalClient(projectId),
          async () => (await orchestrator.listVaults()).map((v) => v.projectId),
        );
      } catch (e) {
        console.error('[init] remote config migration failed:', e);
      }
    },

    listVaults: async () => {
      const vaults = await orchestrator.listVaults();
      set({ vaults });
      return vaults;
    },

    createVault: async (name: string) => {
      const id = await orchestrator.createVault(name);
      await get().listVaults();
      return id;
    },

    deleteVault: async (projectId: string) => {
      await orchestrator.deleteVault(projectId);
      await get().listVaults();
    },

    activateVault: async (projectId: string) => {
      if (get().activeProjectId === projectId) return;
      await orchestrator.activateVault(projectId);
      set({ activeProjectId: projectId });
      await get().loadMenu(projectId);
    },

    deactivateVault: () => {
      orchestrator.deactivateVault();
      set({ activeProjectId: null, menuItems: [] });
    },

    getNoteService: () => {
      return orchestrator.getNoteService();
    },

    loadMenu: async (projectId: string) => {
      const items = await orchestrator.loadMenu(projectId);
      set({ menuItems: items });
    },

    addMenuItem: async (projectId, item) => {
      const updated = await orchestrator.addMenuItem(projectId, get().menuItems, item);
      set({ menuItems: updated });
      get().scheduleAutoSync(projectId);
    },

    updateMenuItem: async (projectId, id, updates) => {
      const updated = await orchestrator.updateMenuItem(projectId, get().menuItems, id, updates);
      set({ menuItems: updated });
      get().scheduleAutoSync(projectId);
    },

    deleteMenuItem: async (projectId, id) => {
      const updated = await orchestrator.deleteMenuItem(projectId, get().menuItems, id);
      set({ menuItems: updated });
      get().scheduleAutoSync(projectId);
    },

    reorderMenuItems: async (projectId, updates) => {
      const updated = await orchestrator.reorderMenuItems(projectId, get().menuItems, updates);
      set({ menuItems: updated });
      get().scheduleAutoSync(projectId);
    },

    getTagsWithCounts: async () => {
      return orchestrator.getTagsWithCounts();
    },

    configureRemote: async (projectId: string, providerId: string, path?: string) => {
      await orchestrator.configureRemote(projectId, providerId, path);
    },

    removeRemote: async (projectId: string, remoteName?: string) => {
      await orchestrator.removeRemote(projectId, remoteName);
    },

    toggleRemote: async (projectId: string, remoteName?: string) => {
      await orchestrator.toggleRemote(projectId, remoteName);
    },

    getRemoteConfig: async (projectId: string, remoteName?: string) => {
      return orchestrator.getRemoteConfig(projectId, remoteName);
    },

    listRemoteVaults: async (providerId: string) => {
      return orchestrator.listRemoteVaults(providerId);
    },

    cloneVault: async (projectId: string) => {
      await orchestrator.cloneVault(projectId);
      await get().listVaults();
    },

    cloneFromProvider: async (providerId: string, path: string, options?: { localPath?: string }) => {
      await orchestrator.cloneFromProvider(providerId, path, options);
      await get().listVaults();
    },

    notifyNoteChange: (projectId, noteId, action, attachmentPaths) => {
      orchestrator.notifyNoteChange(projectId, noteId, action, attachmentPaths);
      set((s) => ({ noteVersion: s.noteVersion + 1 }));
      get().scheduleAutoSync(projectId);
    },

    scheduleAutoSync: (projectId: string) => {
      const existing = syncTimers.get(projectId);
      if (existing) clearTimeout(existing);
      syncTimers.set(
        projectId,
        setTimeout(() => {
          syncTimers.delete(projectId);
          if (!get().isSyncing) {
            get()
              .sync(projectId)
              .catch(() => {});
          }
        }, 1000),
      );
    },

    tryEntrySync: async (projectId: string) => {
      set({ isSyncing: true, syncSuccess: false, lastSyncError: null });
      try {
        const outcome = await orchestrator.tryEntrySync(projectId);
        if (outcome) {
          const errorMsg =
            outcome.result.errors.length > 0 ? outcome.result.errors.join('; ') : null;
          set({
            isSyncing: false,
            syncSuccess: outcome.result.errors.length === 0,
            lastSyncError: errorMsg,
            lastSyncTime: new Date().toISOString(),
            menuItems: outcome.menuItems,
            noteVersion: outcome.noteChanged ? get().noteVersion + 1 : get().noteVersion,
          });
        } else {
          set({ isSyncing: false });
        }
      } catch (e) {
        const msg = (e as Error).message;
        set({ isSyncing: false, syncSuccess: false, lastSyncError: msg });
      }
    },

    sync: async (projectId: string) => {
      set({ isSyncing: true, syncSuccess: false, lastSyncError: null });
      try {
        const outcome = await orchestrator.sync(projectId);
        const errorMsg = outcome.result.errors.length > 0 ? outcome.result.errors.join('; ') : null;
        set({
          isSyncing: false,
          syncSuccess: outcome.result.errors.length === 0,
          lastSyncError: errorMsg,
          lastSyncTime: new Date().toISOString(),
          menuItems: outcome.menuItems,
          noteVersion: outcome.noteChanged ? get().noteVersion + 1 : get().noteVersion,
        });
        return outcome.result;
      } catch (e) {
        const msg = (e as Error).message;
        set({ isSyncing: false, syncSuccess: false, lastSyncError: msg });
        throw e;
      }
    },

    pull: async (projectId: string) => {
      set({ isSyncing: true, syncSuccess: false, lastSyncError: null });
      try {
        const outcome = await orchestrator.pull(projectId);
        const errorMsg = outcome.result.errors.length > 0 ? outcome.result.errors.join('; ') : null;
        set({
          isSyncing: false,
          syncSuccess: outcome.result.errors.length === 0,
          lastSyncError: errorMsg,
          lastSyncTime: new Date().toISOString(),
          menuItems: outcome.menuItems,
          noteVersion: outcome.noteChanged ? get().noteVersion + 1 : get().noteVersion,
        });
        return outcome.result;
      } catch (e) {
        const msg = (e as Error).message;
        set({ isSyncing: false, syncSuccess: false, lastSyncError: msg });
        throw e;
      }
    },

    push: async (projectId: string) => {
      set({ isSyncing: true, syncSuccess: false, lastSyncError: null });
      try {
        const outcome = await orchestrator.push(projectId);
        const errorMsg = outcome.result.errors.length > 0 ? outcome.result.errors.join('; ') : null;
        set({
          isSyncing: false,
          syncSuccess: outcome.result.errors.length === 0,
          lastSyncError: errorMsg,
          lastSyncTime: new Date().toISOString(),
        });
        return outcome.result;
      } catch (e) {
        const msg = (e as Error).message;
        set({ isSyncing: false, syncSuccess: false, lastSyncError: msg });
        throw e;
      }
    },

    rebuildIndex: async (projectId: string) => {
      await orchestrator.getNoteService().rebuildIndex(projectId);
      set((s) => ({ noteVersion: s.noteVersion + 1 }));
    },

    rebuildLedger: async (projectId: string) => {
      await orchestrator.rebuildLedger(projectId);
    },

    exportVault: async (projectId: string) => {
      await orchestrator.exportVault(projectId);
    },

    importVault: async (file: File) => {
      const result = await orchestrator.importVault(file);
      await get().listVaults();
      return result;
    },

    getLoggingEnabled: (projectId: string) => orchestrator.getLoggingEnabled(projectId),
    setLoggingEnabled: (projectId: string, enabled: boolean) =>
      orchestrator.setLoggingEnabled(projectId, enabled),
    readLogs: (projectId: string) => orchestrator.readLogs(projectId),
    clearLogs: (projectId: string) => orchestrator.clearLogs(projectId),

    listVolumeAccesses: () => {
      return orchestrator.getProviderStore().listVolumeAccesses();
    },
    saveVolumeAccess: (access: FsVolumeAccess): VolumeAccessEntry => {
      return orchestrator.getProviderStore().saveVolumeAccess(access);
    },
    deleteVolumeAccess: (volumeUrl: string) => {
      orchestrator.getProviderStore().deleteVolumeAccess(volumeUrl);
    },
  }));
}
