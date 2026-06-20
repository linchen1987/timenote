import { cn, STORAGE_KEYS } from '@timenote/core';
import { GripVertical } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useSidebarStore } from '../stores/sidebar-store';
import { Sheet, SheetContent } from './ui/sheet';

export interface AppShellSidebarRenderCtx {
  variant: 'desktop' | 'mobile';
  onClose: () => void;
}

export interface AppShellProps {
  sidebar: (ctx: AppShellSidebarRenderCtx) => ReactNode;
  children: ReactNode;
  defaultSidebarWidth?: number;
  minSidebarWidth?: number;
  maxSidebarWidth?: number;
}

export function AppShell({
  sidebar,
  children,
  defaultSidebarWidth = 256,
  minSidebarWidth = 200,
  maxSidebarWidth = 500,
}: AppShellProps) {
  const { isMobileSidebarOpen, setMobileSidebarOpen, isDesktopSidebarOpen, setDesktopSidebarOpen } =
    useSidebarStore();
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const savedWidth = localStorage.getItem(STORAGE_KEYS.SIDEBAR_WIDTH);
    if (savedWidth) {
      setSidebarWidth(Number(savedWidth));
    }
    const savedOpen = localStorage.getItem(STORAGE_KEYS.DESKTOP_SIDEBAR_OPEN);
    if (savedOpen === 'false') {
      setDesktopSidebarOpen(false);
    }
  }, [setDesktopSidebarOpen]);

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, e.clientX));
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
  }, [isResizing, minSidebarWidth, maxSidebarWidth]);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <div
        className={cn(
          'hidden md:flex h-full transition-all duration-300 ease-in-out',
          !isDesktopSidebarOpen && 'w-0 opacity-0',
        )}
        style={{ width: isDesktopSidebarOpen ? `${sidebarWidth + 8}px` : '0px' }}
      >
        <div style={{ width: `${sidebarWidth}px` }}>
          {sidebar({ variant: 'desktop', onClose: () => setDesktopSidebarOpen(false) })}
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

      <Sheet open={isMobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72 border-none">
          {sidebar({ variant: 'mobile', onClose: () => setMobileSidebarOpen(false) })}
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-y-auto scroll-smooth relative">{children}</main>
    </div>
  );
}
