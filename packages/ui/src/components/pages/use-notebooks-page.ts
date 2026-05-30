import { createNotebookToken, type VaultMeta } from '@timenote/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { VaultStore } from '../../stores/vault-store';

export type UseVaultStoreHook = {
  (): VaultStore;
  getState: () => VaultStore;
  <T>(selector: (s: VaultStore) => T): T;
};

export interface UseNotebooksPageReturn {
  vaults: VaultMeta[];
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

  const { listVaults, cloneVault, createVault, deleteVault, exportVault, importVault } = useStore();
  const [vaults, setVaults] = useState<VaultMeta[]>([]);
  const [, setIsPulling] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [vaultToDelete, setVaultToDelete] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listVaults();
      setVaults(list);
    } catch (e) {
      toast.error(`Failed to load vaults: ${(e as Error).message}`);
    }
  }, [listVaults]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
