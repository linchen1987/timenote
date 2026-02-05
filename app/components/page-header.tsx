import { Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { useSidebarStore } from '~/lib/stores/sidebar-store';
import { cn } from '~/lib/utils';

interface PageHeaderProps {
  title?: ReactNode;
  leftActions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, leftActions, children, className }: PageHeaderProps) {
  const { isDesktopSidebarOpen, toggleDesktopSidebar, setMobileSidebarOpen } = useSidebarStore();

  return (
    <header
      className={cn(
        'sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-muted/20',
        className,
      )}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-3 flex justify-between items-center min-h-[60px]">
        <div className="flex items-center gap-1 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          {!isDesktopSidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDesktopSidebar}
              className="hidden md:flex shrink-0 h-8 w-8 hover:bg-accent"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
          {leftActions}
          {title && <h2 className="text-lg font-bold truncate pr-4">{title}</h2>}
        </div>

        <div className="flex items-center gap-1 justify-end">{children}</div>
      </div>
    </header>
  );
}
