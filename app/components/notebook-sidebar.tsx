import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown,
  ArrowUp,
  Book,
  ChevronDown,
  Edit2,
  FileText,
  LayoutGrid,
  List,
  Monitor,
  Moon,
  MoreVertical,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sun,
  Tag,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useTheme } from '~/components/theme-provider';
import { TreeMenu } from '~/components/tree-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Separator } from '~/components/ui/separator';
import { MenuService } from '~/lib/services/menu-service';
import { NoteService } from '~/lib/services/note-service';
import type { MenuItem } from '~/lib/types';
import { cn } from '~/lib/utils';
import { createNotebookToken } from '~/lib/utils/token';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface NotebookSidebarProps {
  notebookId: string;
  onSelectSearch: (query: string, menuItemId?: string) => void;
  onSelectNote: (noteId: string, menuItemId?: string) => void;
  onSelectNotebook?: () => void;
  selectedItemId?: string;
  isPWA?: boolean;
  onClose?: () => void;
}

export function NotebookSidebar({
  notebookId,
  onSelectSearch,
  onSelectNote,
  onSelectNotebook,
  selectedItemId,
  isPWA,
  onClose,
  className,
}: NotebookSidebarProps & { className?: string }) {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { notebookToken } = useParams();
  const notebooks = useLiveQuery(() => NoteService.getAllNotebooks()) || [];
  const currentNotebook = notebooks.find((nb) => nb.id === notebookId);

  const isTagsPage = location.pathname.endsWith('/tags');
  const isAllNotesPage =
    !selectedItemId && !isTagsPage && location.pathname === `/s/${notebookToken}`;

  const liveMenuItems =
    useLiveQuery(() => MenuService.getMenuItemsByNotebook(notebookId), [notebookId]) || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    id?: string;
    parentId: string | null;
    name: string;
    type: 'note' | 'search';
    target: string;
  } | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [menuItemToDelete, setMenuItemToDelete] = useState<string | null>(null);

  const handleReorder = async (
    updates: { id: string; order: number; parentId: string | null }[],
  ) => {
    await MenuService.reorderMenuItems(updates);
  };

  const handleOpenAdd = (parentId: string | null = null) => {
    setEditingItem({
      parentId,
      name: '',
      type: 'search',
      target: '',
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem({
      id: item.id,
      parentId: item.parentId,
      name: item.name,
      type: item.type,
      target: item.target,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingItem || !editingItem.name.trim()) return;

    try {
      if (editingItem.id) {
        await MenuService.updateMenuItem(editingItem.id, {
          name: editingItem.name,
          type: editingItem.type,
          target: editingItem.target,
        });
        toast.success('Menu item updated');
      } else {
        await MenuService.createMenuItem({
          notebookId,
          parentId: editingItem.parentId,
          name: editingItem.name,
          type: editingItem.type,
          target: editingItem.target,
          order: liveMenuItems.length,
        });
        toast.success('Menu item created');
      }
      setDialogOpen(false);
      setEditingItem(null);
    } catch (_error) {
      toast.error('Failed to save menu item');
    }
  };

  const handleDelete = (id: string) => {
    setMenuItemToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (menuItemToDelete) {
      try {
        await MenuService.deleteMenuItem(menuItemToDelete);
        setMenuItemToDelete(null);
        setIsDeleteDialogOpen(false);
        toast.success('Menu item deleted');
      } catch (_error) {
        toast.error('Failed to delete menu item');
      }
    }
  };

  const moveUp = async (item: MenuItem) => {
    const siblings = liveMenuItems.filter((i) => i.parentId === item.parentId);
    const index = siblings.findIndex((i) => i.id === item.id);
    if (index > 0) {
      const prev = siblings[index - 1];
      await MenuService.reorderMenuItems([
        { id: item.id, order: prev.order, parentId: item.parentId },
        { id: prev.id, order: item.order, parentId: item.parentId },
      ]);
    }
  };

  const moveDown = async (item: MenuItem) => {
    const siblings = liveMenuItems.filter((i) => i.parentId === item.parentId);
    const index = siblings.findIndex((i) => i.id === item.id);
    if (index < siblings.length - 1) {
      const next = siblings[index + 1];
      await MenuService.reorderMenuItems([
        { id: item.id, order: next.order, parentId: item.parentId },
        { id: next.id, order: item.order, parentId: item.parentId },
      ]);
    }
  };

  return (
    <aside className={cn('bg-sidebar border-r flex flex-col h-full shrink-0 w-full', className)}>
      <div className="p-3 flex justify-between items-center">
        {isPWA ? (
          <Button
            variant="ghost"
            className="px-2 h-9 flex items-center gap-2 max-w-[180px] justify-start overflow-hidden cursor-default"
          >
            <Book className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold truncate text-sidebar-foreground">
              {currentNotebook?.name || 'Notebook'}
            </span>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="px-2 h-9 flex items-center gap-2 hover:bg-sidebar-accent/50 max-w-[180px] justify-start overflow-hidden"
              >
                <Book className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold truncate text-sidebar-foreground">
                  {currentNotebook?.name || 'Notebook'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Switch Notebook
              </div>
              {notebooks.map((nb) => (
                <DropdownMenuItem
                  key={nb.id}
                  onClick={() => {
                    navigate(`/s/${createNotebookToken(nb.id, nb.name)}`);
                    onSelectNotebook?.();
                  }}
                  className={cn(
                    nb.id === notebookId && 'bg-sidebar-accent text-sidebar-accent-foreground',
                  )}
                >
                  <Book className="w-4 h-4 mr-2" />
                  <span className="truncate">{nb.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  navigate('/s/list');
                  onSelectNotebook?.();
                }}
              >
                <List className="w-4 h-4 mr-2" />
                All Notebooks
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex items-center gap-1">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground shrink-0"
            >
              <PanelLeft className="w-5 h-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenAdd(null)}
            className="h-8 w-8 text-muted-foreground shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1 w-full max-w-full overflow-hidden">
          <button
            type="button"
            className={cn(
              'group flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors cursor-pointer text-sm font-medium w-full text-left',
              isAllNotesPage
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
            )}
            onClick={() => {
              onSelectSearch('');
              onSelectNotebook?.();
            }}
          >
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <div className="w-4" />
              <LayoutGrid className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">All Notes</span>
            </div>
          </button>

          <TreeMenu
            items={liveMenuItems}
            onReorder={handleReorder}
            selectedItemId={selectedItemId}
            renderDragOverlay={(node) => (
              <>
                <div className="w-4 flex-shrink-0" />
                {node.type === 'search' ? (
                  <Search className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                )}
                <span className="truncate font-medium text-sm">{node.name}</span>
              </>
            )}
            renderItemContent={(node) => (
              <button
                type="button"
                className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden text-left cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (node.type === 'note') onSelectNote(node.target, node.id);
                  else onSelectSearch(node.target, node.id);
                }}
              >
                {node.type === 'search' ? (
                  <Search className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                )}

                <span className="truncate text-ellipsis overflow-hidden whitespace-nowrap ml-1">
                  {node.name}
                </span>
              </button>
            )}
            renderItemActions={(node) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => handleOpenAdd(node.id)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Child
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => moveUp(node)}>
                    <ArrowUp className="w-4 h-4 mr-2" /> Move Up
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => moveDown(node)}>
                    <ArrowDown className="w-4 h-4 mr-2" /> Move Down
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenEdit(node)}>
                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleDelete(node.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />

          {liveMenuItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <p className="text-xs text-muted-foreground mb-4">No menu items created yet</p>
              <Button variant="outline" size="sm" onClick={() => handleOpenAdd(null)}>
                Create Menu
              </Button>
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
              location.pathname.endsWith('/settings')
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent/50',
            )}
            onClick={() => {
              navigate(`/s/${notebookToken}/settings`);
              onSelectNotebook?.();
            }}
          >
            <Settings className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'flex-1 h-9 justify-center text-sidebar-foreground',
              isTagsPage
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent/50',
            )}
            onClick={() => {
              navigate(`/s/${notebookToken}/tags`);
              onSelectNotebook?.();
            }}
          >
            <Tag className="w-4 h-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="flex-1 h-9 justify-center text-sidebar-foreground hover:bg-sidebar-accent/50"
              >
                {theme === 'light' && <Sun className="w-4 h-4" />}
                {theme === 'dark' && <Moon className="w-4 h-4" />}
                {theme === 'system' && <Monitor className="w-4 h-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-40">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="w-4 h-4 mr-2" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="w-4 h-4 mr-2" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="w-4 h-4 mr-2" /> System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingItem?.id ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            {editingItem && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    placeholder="Menu name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="target">Search Query</Label>
                  <Input
                    id="target"
                    value={editingItem.target}
                    onChange={(e) => setEditingItem({ ...editingItem, target: e.target.value })}
                    placeholder="e.g. #tag1 keyword"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the menu item and all its
              sub-menu items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
