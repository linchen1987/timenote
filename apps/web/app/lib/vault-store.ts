import {
  createPrefixedTransport,
  createVaultExportService,
  createVaultImportService,
  createVaultMenuService,
  createVaultNoteService,
  createVaultService,
  createVaultSyncService,
  type ImportResult,
  type RemoteTransport,
  type RuntimeMenuItem,
  type SyncResult,
  type VaultExportService,
  type VaultImportService,
  type VaultMenuService,
  type VaultMeta,
  type VaultNoteService,
  type VaultService,
  type VaultSyncService,
} from '@timenote/core/vault';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { webTransport } from './web-transport';

interface VaultStore {
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
  lastSyncTime: string | null;

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

  sync: (projectId: string) => Promise<SyncResult>;
  pull: (projectId: string) => Promise<SyncResult>;
  push: (projectId: string) => Promise<SyncResult>;

  exportVault: (projectId: string) => Promise<void>;
  importVault: (file: File) => Promise<ImportResult>;
}

const remoteTransport: RemoteTransport = {
  list: (path) => webTransport.list(path),
  read: (path) => webTransport.read(path),
  write: (path, content) => webTransport.write(path, content),
  exists: (path) => webTransport.exists(path),
  ensureDir: (path) => webTransport.ensureDir(path),
  remove: (path) => webTransport.remove(path),
  isConfigured: () => webTransport.isConfigured(),
};

function getRemoteForProject(projectId: string): RemoteTransport {
  return createPrefixedTransport(`timenote/vaults/${projectId}`, remoteTransport);
}

export const useVaultStore = create<VaultStore>((set, get) => ({
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
  lastSyncTime: null,

  init: async () => {
    if (get().vaultService) return;
    const vaultService = await createVaultService();
    const noteService = createVaultNoteService(vaultService);
    const menuService = createVaultMenuService(vaultService);
    const syncService = createVaultSyncService(vaultService, noteService);
    const exportService = createVaultExportService(vaultService);
    const importService = createVaultImportService(vaultService, noteService);
    set({ vaultService, noteService, menuService, syncService, exportService, importService });
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
      try {
        const status = await syncService.getSyncStatus(projectId);
        set({ lastSyncTime: status.lastSyncTime });
      } catch {
        // ignore
      }
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
    } catch {
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
  },

  reorderMenuItems: async (projectId, updates) => {
    const current = get().menuItems;
    const updated = current.map((item) => {
      const u = updates.find((x) => x.id === item.id);
      return u ? { ...item, order: u.order, parentId: u.parentId } : item;
    });
    await get().menuService?.saveMenu(projectId, updated);
    set({ menuItems: updated });
  },

  sync: async (projectId: string) => {
    if (!remoteTransport.isConfigured()) {
      throw new Error('Storage not configured. Please configure S3 or WebDAV settings.');
    }
    set({ isSyncing: true });
    try {
      const syncService = get().syncService;
      if (!syncService) throw new Error('SyncService not initialized');
      const remote = getRemoteForProject(projectId);
      const result = await syncService.sync(projectId, remote);
      const status = await syncService.getSyncStatus(projectId);
      set({ lastSyncTime: status.lastSyncTime });
      await get().loadMenu(projectId);
      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  pull: async (projectId: string) => {
    if (!remoteTransport.isConfigured()) {
      throw new Error('Storage not configured');
    }
    set({ isSyncing: true });
    try {
      const syncService = get().syncService;
      if (!syncService) throw new Error('SyncService not initialized');
      const remote = getRemoteForProject(projectId);
      const result = await syncService.pull(projectId, remote);
      const status = await syncService.getSyncStatus(projectId);
      set({ lastSyncTime: status.lastSyncTime });
      await get().loadMenu(projectId);
      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  push: async (projectId: string) => {
    if (!remoteTransport.isConfigured()) {
      throw new Error('Storage not configured');
    }
    set({ isSyncing: true });
    try {
      const syncService = get().syncService;
      if (!syncService) throw new Error('SyncService not initialized');
      const remote = getRemoteForProject(projectId);
      const result = await syncService.push(projectId, remote);
      const status = await syncService.getSyncStatus(projectId);
      set({ lastSyncTime: status.lastSyncTime });
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

  importVault: async (file: File) => {
    const importService = get().importService;
    if (!importService) throw new Error('ImportService not initialized');
    const result = await importService.importVault(file);
    await get().listVaults();
    return result;
  },
}));
