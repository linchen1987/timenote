'use client';

import { Outlet, useNavigate, useParams, useSearchParams } from 'react-router';
import { NotebookSidebar } from '~/components/notebook-sidebar';
import { parseNotebookId } from '~/lib/utils/token';

export default function NotebookLayout() {
  const { notebookToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const nbId = parseNotebookId(notebookToken || '');
  const activeMenuItemId = searchParams.get('m') || undefined;

  const handleSelectSearch = (query: string, menuItemId?: string) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (menuItemId) params.set('m', menuItemId);
    navigate(`/s/${notebookToken}?${params.toString()}`);
  };

  const handleSelectNote = (noteId: string, menuItemId?: string) => {
    const params = new URLSearchParams();
    if (menuItemId) params.set('m', menuItemId);
    navigate(`/s/${notebookToken}/${noteId}?${params.toString()}`);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <NotebookSidebar
        notebookId={nbId}
        onSelectSearch={handleSelectSearch}
        onSelectNote={handleSelectNote}
        selectedItemId={activeMenuItemId}
      />
      <main className="flex-1 overflow-y-auto scroll-smooth">
        <Outlet />
      </main>
    </div>
  );
}
