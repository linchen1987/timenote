import {
  createVaultMenuService,
  createVaultNoteService,
  createVaultService,
  type RuntimeMenuItem,
  type VaultMenuService,
  type VaultMeta,
  type VaultNoteService,
  type VaultService,
} from '@timenote/core/vault';
import { nanoid } from 'nanoid';
import { create } from 'zustand';

interface VaultStore {
  vaultService: VaultService | null;
  noteService: VaultNoteService | null;
  menuService: VaultMenuService | null;
  menuItems: RuntimeMenuItem[];
  vaults: VaultMeta[];
  activeProjectId: string | null;

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
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  vaultService: null,
  noteService: null,
  menuService: null,
  menuItems: [],
  vaults: [],
  activeProjectId: null,

  init: async () => {
    if (get().vaultService) return;
    const vaultService = await createVaultService();
    const noteService = createVaultNoteService(vaultService);
    const menuService = createVaultMenuService(vaultService);
    set({ vaultService, noteService, menuService });
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
}));
