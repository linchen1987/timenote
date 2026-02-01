'use client';

import { GripVertical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, useSearchParams } from 'react-router';
import { NotebookSidebar } from '~/components/notebook-sidebar';
import { Sheet, SheetContent } from '~/components/ui/sheet';
import { usePWA } from '~/hooks/use-pwa';
import { STORAGE_KEYS } from '~/lib/constants';
import { useSidebarStore } from '~/lib/stores/sidebar-store';
import { cn } from '~/lib/utils';
import { parseNotebookId } from '~/lib/utils/token';

export default function NotebookLayout() {
  const { notebookToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const nbId = parseNotebookId(notebookToken || '');
  const activeMenuItemId = searchParams.get('m') || undefined;
  const { isMobileSidebarOpen, setMobileSidebarOpen, isDesktopSidebarOpen, setDesktopSidebarOpen } =
    useSidebarStore();
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const isPWA = usePWA();

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
    navigate(`/s/${notebookToken}/${noteId}?${params.toString()}`);
    setMobileSidebarOpen(false);
  };

  useEffect(() => {
    const savedWidth = localStorage.getItem(STORAGE_KEYS.SIDEBAR_WIDTH);
    if (savedWidth) {
      setSidebarWidth(Number(savedWidth));
    }
  }, []);

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_WIDTH, String(newWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <div
        className={cn(
          'hidden md:flex h-full transition-all duration-300 ease-in-out',
          !isDesktopSidebarOpen && 'w-0 opacity-0',
        )}
        style={{ width: isDesktopSidebarOpen ? `${sidebarWidth + 8}px` : '0px' }}
      >
        <div style={{ width: `${sidebarWidth}px` }}>
          <NotebookSidebar
            notebookId={nbId}
            onSelectSearch={handleSelectSearch}
            onSelectNote={handleSelectNote}
            selectedItemId={activeMenuItemId}
            isPWA={isPWA}
            onClose={() => setDesktopSidebarOpen(false)}
          />
        </div>
        <button
          type="button"
          className="w-1 cursor-col-resize border-none p-0 bg-transparent hover:bg-transparent flex items-center justify-center relative group"
          onMouseDown={handleMouseDown}
          aria-label="Resize sidebar"
          style={{ width: '8px' }}
        >
          <GripVertical className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity" />
        </button>
      </div>

      {/* Mobile Sidebar (Drawer) */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72 border-none">
          <NotebookSidebar
            notebookId={nbId}
            onSelectSearch={handleSelectSearch}
            onSelectNote={handleSelectNote}
            onSelectNotebook={() => setMobileSidebarOpen(false)}
            selectedItemId={activeMenuItemId}
            isPWA={isPWA}
            className="w-full border-none"
          />
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-y-auto scroll-smooth relative">
        <Outlet />
      </main>
    </div>
  );
}
