'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Outlet, useNavigate, useParams, useSearchParams } from 'react-router';
import { NotebookSidebar } from '~/components/notebook-sidebar';
import { Button } from '~/components/ui/button';
import { Sheet, SheetContent } from '~/components/ui/sheet';
import { parseNotebookId } from '~/lib/utils/token';

export default function NotebookLayout() {
  const { notebookToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const nbId = parseNotebookId(notebookToken || '');
  const activeMenuItemId = searchParams.get('m') || undefined;
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleSelectSearch = (query: string, menuItemId?: string) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (menuItemId) params.set('m', menuItemId);
    navigate(`/s/${notebookToken}?${params.toString()}`);
    setIsMobileOpen(false);
  };

  const handleSelectNote = (noteId: string, menuItemId?: string) => {
    const params = new URLSearchParams();
    if (menuItemId) params.set('m', menuItemId);
    navigate(`/s/${notebookToken}/${noteId}?${params.toString()}`);
    setIsMobileOpen(false);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full">
        <NotebookSidebar
          notebookId={nbId}
          onSelectSearch={handleSelectSearch}
          onSelectNote={handleSelectNote}
          selectedItemId={activeMenuItemId}
        />
      </div>

      {/* Mobile Sidebar (Drawer) */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 border-none">
          <NotebookSidebar
            notebookId={nbId}
            onSelectSearch={handleSelectSearch}
            onSelectNote={handleSelectNote}
            onSelectNotebook={() => setIsMobileOpen(false)}
            selectedItemId={activeMenuItemId}
            className="w-full border-none"
          />
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-y-auto scroll-smooth relative">
        <Outlet context={{ setIsSidebarOpen: setIsMobileOpen }} />
      </main>
    </div>
  );
}
