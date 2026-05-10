import { createNotebookToken, type VaultMeta, type VaultStore } from '@timenote/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type UseVaultStoreHook = {
  (): VaultStore;
  getState: () => VaultStore;
  <T>(selector: (s: VaultStore) => T): T;
};

export interface UseNotebooksPageReturn {
  vaults: VaultMeta[];
  remoteOnlyVaults: VaultMeta[];
  isLoadingRemote: boolean;
  isPulling: string | null;
  isCreating: boolean;
  setIsCreating: (v: boolean) => void;
  newName: string;
  setNewName: (v: string) => void;
  editingId: string | null;
  setEditingId: (v: string | null) => void;
  editName: string;
  setEditName: (v: string) => void;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (v: boolean) => void;
  vaultToDelete: string | null;
  setVaultToDelete: (v: string | null) => void;
  isExporting: string | null;
  isImporting: boolean;
  hasLegacyData: boolean;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  handleCreate: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleExport: (projectId: string) => Promise<void>;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handlePullVault: (projectId: string) => Promise<void>;
  refresh: () => Promise<void>;
  getNotebookLink: (v: VaultMeta) => string;
  messages: {
    created: string;
    deleted: string;
    exported: string;
    pulled: string;
  };
}

export interface UseNotebooksPageOptions {
  messages?: {
    created?: string;
    deleted?: string;
    exported?: string;
    pulled?: string;
  };
}

export function useNotebooksPage(
  useStore: UseVaultStoreHook,
  options?: UseNotebooksPageOptions,
): UseNotebooksPageReturn {
  const msg = {
    created: options?.messages?.created ?? 'Vault created',
    deleted: options?.messages?.deleted ?? 'Vault deleted',
    exported: options?.messages?.exported ?? 'Vault exported',
    pulled: options?.messages?.pulled ?? 'Vault pulled from remote',
  };

  const {
    listVaults,
    listRemoteVaults,
    cloneVault,
    createVault,
    deleteVault,
    exportVault,
    importVault,
    checkMigration,
  } = useStore();
  const [vaults, setVaults] = useState<VaultMeta[]>([]);
  const [remoteOnlyVaults, setRemoteOnlyVaults] = useState<VaultMeta[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [isPulling, setIsPulling] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [vaultToDelete, setVaultToDelete] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [hasLegacyData, setHasLegacyData] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listVaults();
      setVaults(list);

      setIsLoadingRemote(true);
      try {
        const remoteList = await listRemoteVaults();
        const localIds = new Set(list.map((v) => v.projectId));
        setRemoteOnlyVaults(remoteList.filter((v) => !localIds.has(v.projectId)));
      } catch {
        setRemoteOnlyVaults([]);
      } finally {
        setIsLoadingRemote(false);
      }
    } catch (e) {
      toast.error(`Failed to load vaults: ${(e as Error).message}`);
    }
  }, [listVaults, listRemoteVaults]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    checkMigration()
      .then(setHasLegacyData)
      .catch(() => {});
  }, [checkMigration]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createVault(newName.trim());
      toast.success(msg.created);
      setNewName('');
      setIsCreating(false);
      await refresh();
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    }
  };

  const handleDelete = async () => {
    if (!vaultToDelete) return;
    try {
      await deleteVault(vaultToDelete);
      toast.success(msg.deleted);
      setVaultToDelete(null);
      setIsDeleteDialogOpen(false);
      await refresh();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  };

  const handleExport = async (projectId: string) => {
    setIsExporting(projectId);
    try {
      await exportVault(projectId);
      toast.success(msg.exported);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const result = await importVault(file);
      toast.success(`Imported "${result.vaultName}" with ${result.notesCount} notes`);
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} files skipped during import`);
      }
      await refresh();
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const getNotebookLink = (v: VaultMeta) => `/s/${createNotebookToken(v.projectId, v.name)}`;

  const handlePullVault = async (projectId: string) => {
    setIsPulling(projectId);
    try {
      await cloneVault(projectId);
      toast.success(msg.pulled);
      await refresh();
    } catch (e) {
      toast.error(`Pull failed: ${(e as Error).message}`);
    } finally {
      setIsPulling(null);
    }
  };

  return {
    vaults,
    remoteOnlyVaults,
    isLoadingRemote,
    isPulling,
    isCreating,
    setIsCreating,
    newName,
    setNewName,
    editingId,
    setEditingId,
    editName,
    setEditName,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    vaultToDelete,
    setVaultToDelete,
    isExporting,
    isImporting,
    hasLegacyData,
    importInputRef,
    handleCreate,
    handleDelete,
    handleExport,
    handleImport,
    handlePullVault,
    refresh,
    getNotebookLink,
    messages: msg,
  };
}
