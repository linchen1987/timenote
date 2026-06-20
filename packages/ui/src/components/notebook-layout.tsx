import { noteIdToUrl, parseNotebookId, type RuntimeMenuItem } from '@timenote/core';
import { useEffect } from 'react';
import { Outlet, useNavigate, useParams, useSearchParams } from 'react-router';
import { useSidebarStore } from '../stores/sidebar-store';
import { AppShell } from './app-shell';
import { type MenuActions, NotebookSidebar } from './notebook-sidebar';

export interface NotebookLayoutProps {
  isPWA: boolean;
  onSaveLastNotebook?: (token: string) => void;
  extraEffects?: (notebookToken: string) => undefined | (() => void);
  notebookName?: string;
  notebooks?: { id: string; name: string }[];
  menuItems?: RuntimeMenuItem[];
  menuActions?: MenuActions;
  onOpenNotebook?: (token: string, name: string) => void;
  onOpenNotebookList?: () => void;
}

export function NotebookLayout({
  isPWA,
  onSaveLastNotebook,
  extraEffects,
  notebookName,
  notebooks,
  menuItems,
  menuActions,
  onOpenNotebook,
  onOpenNotebookList,
}: NotebookLayoutProps) {
  const { notebookToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const nbId = parseNotebookId(notebookToken || '');
  const activeMenuItemId = searchParams.get('m') || undefined;
  const { setMobileSidebarOpen } = useSidebarStore();

  useEffect(() => {
    if (notebookToken && onSaveLastNotebook) {
      onSaveLastNotebook(notebookToken);
    }
  }, [notebookToken, onSaveLastNotebook]);

  useEffect(() => {
    if (notebookToken && extraEffects) {
      return extraEffects(notebookToken);
    }
  }, [notebookToken, extraEffects]);

  const handleSelectSearch = (query: string, menuItemId?: string) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (menuItemId) params.set('m', menuItemId);
    navigate(`/s/${notebookToken}?${params.toString()}`);
    setMobileSidebarOpen(false);
  };

  const handleSelectNote = (noteId: string, menuItemId?: string) => {
    const params = new URLSearchParams();
    if (menuItemId) params.set('m', menuItemId);
    navigate(`/s/${notebookToken}/${noteIdToUrl(noteId)}?${params.toString()}`);
    setMobileSidebarOpen(false);
  };

  const sidebarProps = {
    notebookId: nbId,
    notebookName,
    notebooks,
    menuItems: menuItems ?? [],
    menuActions: menuActions ?? {
      reorder: async () => {},
      add: async () => {},
      update: async () => {},
      delete: async () => {},
    },
    onSelectSearch: handleSelectSearch,
    onSelectNote: handleSelectNote,
    onOpenNotebook,
    onOpenNotebookList,
    selectedItemId: activeMenuItemId,
    isPWA,
  };

  return (
    <AppShell
      sidebar={({ variant, onClose }) =>
        variant === 'desktop' ? (
          <NotebookSidebar {...sidebarProps} onClose={onClose} />
        ) : (
          <NotebookSidebar
            {...sidebarProps}
            onSelectNotebook={onClose}
            className="w-full border-none"
          />
        )
      }
    >
      <Outlet />
    </AppShell>
  );
}
