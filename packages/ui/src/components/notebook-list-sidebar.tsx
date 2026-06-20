import { cn, type VaultMeta } from '@timenote/core';
import {
  Book,
  Download,
  Loader2,
  MoreVertical,
  Notebook as NotebookIcon,
  PanelLeft,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { ThemeToggle } from './theme-toggle';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

export interface NotebookListSidebarProps {
  vaults: VaultMeta[];
  variant: 'desktop' | 'mobile';
  activeFooter?: 'notebooks' | 'settings';
  onOpen: (vault: VaultMeta) => void;
  onCreate: () => void;
  onExport: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onClose: () => void;
  isExporting?: string | null;
  className?: string;
}

export function NotebookListSidebar({
  vaults,
  variant,
  activeFooter = 'notebooks',
  onOpen,
  onCreate,
  onExport,
  onDelete,
  onClose,
  isExporting,
  className,
}: NotebookListSidebarProps) {
  const navigate = useNavigate();

  const handleOpen = (vault: VaultMeta) => {
    onOpen(vault);
    if (variant === 'mobile') {
      onClose();
    }
  };

  const handleCreate = () => {
    onCreate();
    if (variant === 'mobile') {
      onClose();
    }
  };

  const goHome = () => {
    navigate('/s/list');
    if (variant === 'mobile') {
      onClose();
    }
  };

  const goToSettings = () => {
    navigate('/settings');
    if (variant === 'mobile') {
      onClose();
    }
  };

  return (
    <aside className={cn('bg-sidebar border-r flex flex-col h-full shrink-0 w-full', className)}>
      <div className="p-3 flex justify-between items-center gap-1">
        <button
          type="button"
          onClick={goHome}
          className="px-2 h-9 flex items-center gap-2 max-w-[180px] justify-start overflow-hidden rounded-md hover:bg-sidebar-accent/50 transition-colors"
        >
          <Book className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold truncate text-sidebar-foreground">Notebooks</span>
        </button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleCreate}
            aria-label="New notebook"
          >
            <Plus className="w-4 h-4" />
          </Button>
          {variant === 'desktop' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              aria-label="Collapse sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Local Notebooks
        </div>
        <div className="px-1.5 pb-2 flex flex-col gap-0.5">
          {vaults.map((v) => (
            <div
              key={v.projectId}
              className="group/row flex items-center gap-1 rounded-md pr-1 h-9 hover:bg-sidebar-accent/50 transition-colors"
            >
              <button
                type="button"
                className="flex flex-1 items-center gap-2 min-w-0 h-full pl-2 text-left"
                onClick={() => handleOpen(v)}
              >
                <Book className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate text-sm text-sidebar-foreground">{v.name}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 group-hover/row:opacity-100 focus:opacity-100"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={() => onExport(v.projectId)}
                    disabled={isExporting === v.projectId}
                  >
                    {isExporting === v.projectId ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    导出
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(v.projectId)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> 删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {vaults.length === 0 && (
            <div className="px-2 py-8 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-sidebar-accent/40 flex items-center justify-center text-muted-foreground">
                <NotebookIcon className="w-5 h-5" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                暂无笔记本
                <br />
                点击上方 + 创建
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-2 border-t bg-sidebar-accent/20">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'flex-1 h-9 justify-center text-sidebar-foreground',
              activeFooter === 'settings'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent/50',
            )}
            onClick={goToSettings}
            aria-label="设置"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <ThemeToggle variant="compact" />
        </div>
      </div>
    </aside>
  );
}
