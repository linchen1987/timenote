import {
  createVaultNoteService,
  createVaultService,
  type VaultMeta,
  type VaultNoteService,
  type VaultService,
} from '@timenote/core/vault';
import { create } from 'zustand';

interface VaultStore {
  vaultService: VaultService | null;
  noteService: VaultNoteService | null;

  init: () => Promise<void>;
  listVaults: () => Promise<VaultMeta[]>;
  createVault: (name: string) => Promise<string>;
  deleteVault: (projectId: string) => Promise<void>;

  activateVault: (projectId: string) => Promise<void>;
  deactivateVault: () => void;

  getNoteService: () => VaultNoteService;
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  vaultService: null,
  noteService: null,

  init: async () => {
    if (get().vaultService) return;
    const vaultService = await createVaultService();
    const noteService = createVaultNoteService(vaultService);
    set({ vaultService, noteService });
  },

  listVaults: async () => {
    await get().init();
    return get().vaultService?.listVaults();
  },

  createVault: async (name: string) => {
    await get().init();
    return get().vaultService?.createVault(name);
  },

  deleteVault: async (projectId: string) => {
    await get().init();
    await get().vaultService?.deleteVault(projectId);
  },

  activateVault: async (projectId: string) => {
    await get().init();
    await get().vaultService?.listVaults();
    await get().noteService?.activateVault(projectId);
  },

  deactivateVault: () => {
    get().noteService?.deactivateVault();
  },

  getNoteService: () => {
    const svc = get().noteService;
    if (!svc) throw new Error('VaultNoteService not initialized');
    return svc;
  },
}));
