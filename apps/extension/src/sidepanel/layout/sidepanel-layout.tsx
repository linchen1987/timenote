import { cn } from '@timenote/core';
import { Button } from '@timenote/ui';
import { Book, Settings, Tag } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router';

export function SidepanelLayout() {
  const location = useLocation();

  const isNotebook = location.pathname.startsWith('/notebook/');

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-3 py-2 border-b border-border">
        <Link to="/" className="text-sm font-bold tracking-tight">
          TimeNote
        </Link>
        <div className="flex items-center gap-1">
          {isNotebook && (
            <NavButton to={getTagsPath(location.pathname)} title="Tags">
              <Tag className="h-4 w-4" />
            </NavButton>
          )}
          <NavButton to="/settings" title="Settings">
            <Settings className="h-4 w-4" />
          </NavButton>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

function NavButton({
  to,
  title,
  children,
}: {
  to: string;
  title: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to}>
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-7 w-7', isActive && 'bg-accent')}
        title={title}
      >
        {children}
      </Button>
    </Link>
  );
}

function getTagsPath(pathname: string): string {
  const match = pathname.match(/\/notebook\/([^/]+)/);
  if (match) return `/notebook/${match[1]}/tags`;
  return '/';
}
