import type {
  ImportResult,
  RemoteEntry,
  RuntimeMenuItem,
  SyncResult,
  VaultMeta,
  VaultNoteService,
  VaultOrchestrator,
} from '@timenote/core';
import { create } from 'zustand';

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

    configureRemote: (projectId: string, providerId: string, path?: string) => {
      orchestrator.configureRemote(projectId, providerId, path);
    },

    removeRemote: (projectId: string, remoteName?: string) => {
      orchestrator.removeRemote(projectId, remoteName);
    },

    toggleRemote: (projectId: string, remoteName?: string) => {
      orchestrator.toggleRemote(projectId, remoteName);
    },

    getRemoteConfig: (projectId: string, remoteName?: string) => {
      return orchestrator.getRemoteConfig(projectId, remoteName);
    },

    listRemoteVaults: async (providerId: string) => {
      return orchestrator.listRemoteVaults(providerId);
    },

    cloneVault: async (projectId: string) => {
      await orchestrator.cloneVault(projectId);
      await get().listVaults();
    },

    cloneFromProvider: async (providerId: string, path: string) => {
      await orchestrator.cloneFromProvider(providerId, path);
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
      const outcome = await orchestrator.tryEntrySync(projectId);
      if (outcome) {
        const errorMsg = outcome.result.errors.length > 0 ? outcome.result.errors.join('; ') : null;
        set({
          isSyncing: false,
          syncSuccess: outcome.result.errors.length === 0,
          lastSyncError: errorMsg,
          lastSyncTime: new Date().toISOString(),
          menuItems: outcome.menuItems,
          noteVersion: outcome.noteChanged ? get().noteVersion + 1 : get().noteVersion,
        });
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

    exportVault: async (projectId: string) => {
      await orchestrator.exportVault(projectId);
    },

    importVault: async (file: File) => {
      const result = await orchestrator.importVault(file);
      await get().listVaults();
      return result;
    },
  }));
}
