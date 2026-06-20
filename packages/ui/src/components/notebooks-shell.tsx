import { createNotebookToken, type VaultMeta } from '@timenote/core';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { AppShell } from './app-shell';
import { CreateNotebookDialog } from './create-notebook-dialog';
import { NotebookListSidebar } from './notebook-list-sidebar';
import { OpenCloudDialog } from './open-cloud-dialog';
import { type UseVaultStoreHook, useNotebooksPage } from './pages/use-notebooks-page';
import { useProviderScanner } from './pages/use-provider-scanner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

export interface NotebooksShellContextValue {
  vaults: VaultMeta[];
  triggerCreate: () => void;
  triggerImport: () => void;
  openCloud: () => void;
  openFolder?: () => void;
  isImporting: boolean;
  isExporting: string | null;
}

const NotebooksShellContext = createContext<NotebooksShellContextValue | null>(null);

export function useNotebooksShell(): NotebooksShellContextValue {
  const ctx = useContext(NotebooksShellContext);
  if (!ctx) {
    throw new Error('useNotebooksShell must be used within NotebooksShell');
  }
  return ctx;
}

export interface NotebooksShellProps {
  useVaultStore: UseVaultStoreHook;
  messages?: {
    created?: string;
    deleted?: string;
    exported?: string;
    pulled?: string;
  };
  onOpenVault?: () => void;
  onOpenNotebook?: (token: string, name: string) => void;
  onCreateVault?: () => void;
  onPickCloneDir?: () => Promise<string | null>;
  activeFooter?: 'notebooks' | 'settings';
  children: ReactNode;
}

export function NotebooksShell({
  useVaultStore: useStore,
  messages,
  onOpenVault,
  onOpenNotebook,
  onCreateVault,
  onPickCloneDir,
  activeFooter = 'notebooks',
  children,
}: NotebooksShellProps) {
  const {
    vaults,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    setVaultToDelete,
    isExporting,
    isImporting,
    importInputRef,
    handleDelete,
    handleExport,
    handleImport,
    getNotebookLink,
    refresh,
    messages: msg,
  } = useNotebooksPage(useStore, messages ? { messages } : undefined);

  const scanner = useProviderScanner(useStore, vaults, refresh, onPickCloneDir);
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCloudOpen, setIsCloudOpen] = useState(false);

  const openVault = (v: VaultMeta) => {
    if (onOpenNotebook) {
      onOpenNotebook(createNotebookToken(v.projectId, v.name), v.name);
    } else {
      navigate(getNotebookLink(v));
    }
  };

  const triggerCreate = () => {
    if (onCreateVault) {
      onCreateVault();
    } else {
      setIsCreateOpen(true);
    }
  };

  const handleDialogCreate = async (name: string) => {
    try {
      await useStore.getState().createVault(name);
      toast.success(msg.created);
      await refresh();
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    }
  };

  const requestDelete = (projectId: string) => {
    setVaultToDelete(projectId);
    setIsDeleteDialogOpen(true);
  };

  const ctx: NotebooksShellContextValue = {
    vaults,
    triggerCreate,
    triggerImport: () => importInputRef.current?.click(),
    openCloud: () => setIsCloudOpen(true),
    openFolder: onOpenVault,
    isImporting,
    isExporting,
  };

  return (
    <NotebooksShellContext.Provider value={ctx}>
      <AppShell
        sidebar={({ variant, onClose }) => (
          <NotebookListSidebar
            vaults={vaults}
            variant={variant}
            activeFooter={activeFooter}
            onClose={onClose}
            onOpen={openVault}
            onCreate={triggerCreate}
            onExport={handleExport}
            onDelete={requestDelete}
            isExporting={isExporting}
            className={variant === 'mobile' ? 'w-full border-none' : undefined}
          />
        )}
      >
        {children}

        <input
          ref={importInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleImport}
        />

        <CreateNotebookDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onCreate={handleDialogCreate}
        />

        <OpenCloudDialog open={isCloudOpen} onOpenChange={setIsCloudOpen} scanner={scanner} />

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确定要删除吗？</AlertDialogTitle>
              <AlertDialogDescription>
                此操作无法撤销。该笔记本及其所有笔记将被永久删除。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AppShell>
    </NotebooksShellContext.Provider>
  );
}
