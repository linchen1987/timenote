import {
  closestCenter,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown,
  ArrowUp,
  Book,
  ChevronDown,
  ChevronRight,
  Edit2,
  FileText,
  GripVertical,
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useTheme } from '~/components/theme-provider';
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
  const [items, setItems] = useState<MenuItem[]>([]);
  const itemsRef = useRef<MenuItem[]>([]);
  const lastLiveItemsRef = useRef<string>('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<{
    id: string;
    type: 'before' | 'after' | 'inside';
  } | null>(null);

  useEffect(() => {
    if (liveMenuItems && !activeId && !isRepositioning) {
      const liveKey = JSON.stringify(liveMenuItems);
      if (liveKey !== lastLiveItemsRef.current) {
        lastLiveItemsRef.current = liveKey;
        setItems((prev) => {
          if (JSON.stringify(prev) === liveKey) {
            return prev;
          }
          itemsRef.current = liveMenuItems;
          return liveMenuItems;
        });
      }
    }
  }, [liveMenuItems, activeId, isRepositioning]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (items.length > 0) {
      setExpandedIds((prev) => {
        if (prev.size > 0) return prev;
        const allFolderIds = items
          .filter((i) => items.some((child) => child.parentId === i.id))
          .map((i) => i.id);
        return new Set(allFolderIds);
      });
    }
  }, [items]);

  const visibleItems = useMemo(() => {
    return flattenTree(items, expandedIds);
  }, [items, expandedIds]);

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDropIndicator(null);
    const element = document.querySelector(`[data-id="${event.active.id}"]`);
    if (element) {
      setActiveWidth(element.getBoundingClientRect().width * 0.9);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over, pointerCoordinates } = event;
    if (!over || !pointerCoordinates || active.id === over.id) {
      setDropIndicator(null);
      return;
    }

    const overElement = document.querySelector(`[data-id="${over.id}"]`);
    if (!overElement) return;

    const rect = overElement.getBoundingClientRect();
    const relativeY = pointerCoordinates.y - rect.top;
    const ratio = relativeY / rect.height;

    let type: 'before' | 'after' | 'inside';
    // Precise thresholds for better UX
    if (ratio < 0.25) {
      type = 'before';
    } else if (ratio > 0.75) {
      type = 'after';
    } else {
      type = 'inside';
    }

    setDropIndicator({
      id: String(over.id),
      type,
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const currentIndicator = dropIndicator;

    // Reset UI states immediately for responsiveness
    setActiveId(null);
    setActiveWidth(null);
    setDropIndicator(null);

    if (!over || active.id === over.id) return;

    const activeItem = items.find((i) => i.id === active.id);
    const overItem = items.find((i) => i.id === over.id);

    if (!activeItem || !overItem) return;

    // Recursive check to prevent cycles
    const isDescendant = (parentId: string, childId: string): boolean => {
      const children = itemsRef.current.filter((i) => i.parentId === parentId);
      for (const child of children) {
        if (child.id === childId) return true;
        if (isDescendant(child.id, childId)) return true;
      }
      return false;
    };

    if (isDescendant(activeItem.id, overItem.id)) {
      toast.error('Cannot move an item into its own child');
      return;
    }

    setIsRepositioning(true);

    const dropZone = currentIndicator?.id === String(over.id) ? currentIndicator.type : 'after';
    let targetParentId: string | null;
    let targetIndex: number;

    if (dropZone === 'inside') {
      targetParentId = overItem.id;
      // When dropping inside, we put it at the beginning of the children list
      targetIndex = 0;
    } else {
      targetParentId = overItem.parentId;
      // Calculate target index relative to siblings
      const siblings = itemsRef.current
        .filter((i) => i.parentId === targetParentId && i.id !== activeItem.id)
        .sort((a, b) => a.order - b.order);

      const overIndex = siblings.findIndex((s) => s.id === overItem.id);
      targetIndex = dropZone === 'before' ? overIndex : overIndex + 1;
    }

    // Comprehensive update logic
    const allUpdates: { id: string; order: number; parentId: string | null }[] = [];

    // 1. Process Target Level
    const targetSiblings = itemsRef.current
      .filter((i) => i.parentId === targetParentId && i.id !== activeItem.id)
      .sort((a, b) => a.order - b.order);

    targetSiblings.splice(targetIndex < 0 ? 0 : targetIndex, 0, {
      ...activeItem,
      parentId: targetParentId,
    });

    targetSiblings.forEach((item, index) => {
      allUpdates.push({ id: item.id, order: index, parentId: targetParentId });
    });

    // 2. Process Source Level (if different)
    if (activeItem.parentId !== targetParentId) {
      const sourceSiblings = itemsRef.current
        .filter((i) => i.parentId === activeItem.parentId && i.id !== activeItem.id)
        .sort((a, b) => a.order - b.order);

      sourceSiblings.forEach((item, index) => {
        allUpdates.push({ id: item.id, order: index, parentId: activeItem.parentId });
      });
    }

    // Optimistic UI Update
    const newItems = items.map((item) => {
      const update = allUpdates.find((u) => u.id === item.id);
      return update ? { ...item, order: update.order, parentId: update.parentId } : item;
    });

    itemsRef.current = newItems;
    setItems(newItems);

    try {
      await MenuService.reorderMenuItems(allUpdates);
      // Extra stabilization time for the live query to update from IndexedDB
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error('Reorder failed:', error);
      toast.error('Failed to save new order');
      setItems(liveMenuItems);
      itemsRef.current = liveMenuItems;
    } finally {
      setIsRepositioning(false);
    }
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
          order: items.length,
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
    const siblings = items.filter((i) => i.parentId === item.parentId);
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
    const siblings = items.filter((i) => i.parentId === item.parentId);
    const index = siblings.findIndex((i) => i.id === item.id);
    if (index < siblings.length - 1) {
      const next = siblings[index + 1];
      await MenuService.reorderMenuItems([
        { id: item.id, order: next.order, parentId: item.parentId },
        { id: next.id, order: item.order, parentId: item.parentId },
      ]);
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeItem = useMemo(
    () => (activeId ? items.find((i) => i.id === activeId) : null),
    [activeId, items],
  );

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

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setActiveId(null);
              setActiveWidth(null);
              setDropIndicator(null);
            }}
          >
            <SortableContext
              items={visibleItems.map((n) => n.id)}
              strategy={verticalListSortingStrategy}
            >
              {visibleItems.map((node) => (
                <MenuItemComponent
                  key={node.id}
                  node={node}
                  onSelectNote={onSelectNote}
                  onSelectSearch={onSelectSearch}
                  onAddChild={handleOpenAdd}
                  onUpdate={handleOpenEdit}
                  onDelete={handleDelete}
                  onMoveUp={moveUp}
                  onMoveDown={moveDown}
                  selectedItemId={selectedItemId}
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                  dropIndicator={dropIndicator?.id === node.id ? dropIndicator.type : null}
                />
              ))}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeItem ? (
                <div
                  className="py-1.5 px-2 bg-sidebar-accent text-sidebar-accent-foreground rounded-md shadow-xl border border-primary/20 scale-[1.02] flex items-center gap-2 pointer-events-none"
                  style={{ width: activeWidth ?? undefined }}
                >
                  <div className="w-4 flex-shrink-0" />
                  {activeItem.type === 'search' ? (
                    <Search className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate font-medium text-sm">{activeItem.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {items.length === 0 && (
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

function flattenTree(
  items: MenuItem[],
  expandedIds: Set<string>,
): (MenuItem & { level: number; hasChildren: boolean })[] {
  const itemIds = new Set(items.map((i) => i.id));

  // Roots are items with no parent OR parent not in the list (orphans)
  const rootItems = items
    .filter((i) => !i.parentId || !itemIds.has(i.parentId))
    .sort((a, b) => a.order - b.order);

  const result: (MenuItem & { level: number; hasChildren: boolean })[] = [];

  function traverse(item: MenuItem, level: number) {
    const children = items.filter((i) => i.parentId === item.id).sort((a, b) => a.order - b.order);

    result.push({ ...item, level, hasChildren: children.length > 0 });

    if (expandedIds.has(item.id)) {
      for (const child of children) {
        traverse(child, level + 1);
      }
    }
  }

  for (const root of rootItems) {
    traverse(root, 0);
  }

  return result;
}

function MenuItemComponent({
  node,
  onSelectNote,
  onSelectSearch,
  onAddChild,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  selectedItemId,
  expandedIds,
  onToggleExpand,
  dropIndicator,
}: {
  node: MenuItem & { level: number; hasChildren: boolean };
  onSelectNote: (id: string, menuItemId?: string) => void;
  onSelectSearch: (q: string, menuItemId?: string) => void;
  onAddChild: (id: string) => void;
  onUpdate: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  onMoveUp: (item: MenuItem) => void;
  onMoveDown: (item: MenuItem) => void;
  selectedItemId?: string;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  dropIndicator: 'before' | 'after' | 'inside' | null;
}) {
  const isSelected = selectedItemId === node.id;
  const isExpanded = expandedIds.has(node.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: node,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    paddingLeft: `${node.level * 0.5 + 0.5}rem`,
  };

  const indicatorMarginLeft = `${node.level * 0.5 + 1.5}rem`;

  return (
    <div
      ref={setNodeRef}
      data-id={node.id}
      style={style}
      className={cn(
        'group relative flex items-center gap-2 py-1.5 px-2 rounded-md transition-all cursor-pointer text-sm font-medium w-full max-w-full overflow-hidden',
        isSelected
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
        dropIndicator === 'inside' && 'bg-primary/10 ring-2 ring-primary/40 ring-inset',
      )}
    >
      {/* Drop indicators */}
      {dropIndicator === 'before' && (
        <div
          className="absolute top-0 right-2 h-0.5 bg-primary z-20 rounded-full"
          style={{ left: indicatorMarginLeft }}
        />
      )}
      {dropIndicator === 'after' && (
        <div
          className="absolute bottom-0 right-2 h-0.5 bg-primary z-20 rounded-full"
          style={{ left: indicatorMarginLeft }}
        />
      )}

      <button
        type="button"
        className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden text-left cursor-pointer"
        onClick={() => {
          if (node.type === 'note') onSelectNote(node.target, node.id);
          else onSelectSearch(node.target, node.id);
        }}
      >
        {node.hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            <ChevronRight
              className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-90')}
            />
          </Button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        {node.type === 'search' ? (
          <Search className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
        ) : (
          <FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
        )}

        <span className="truncate text-ellipsis overflow-hidden whitespace-nowrap ml-1">
          {node.name}
        </span>
      </button>

      <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 ml-1">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="p-1 cursor-grab active:cursor-grabbing hover:bg-sidebar-accent rounded mr-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onAddChild(node.id)}>
              <Plus className="w-4 h-4 mr-2" /> Add Child
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveUp(node)}>
              <ArrowUp className="w-4 h-4 mr-2" /> Move Up
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveDown(node)}>
              <ArrowDown className="w-4 h-4 mr-2" /> Move Down
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdate(node)}>
              <Edit2 className="w-4 h-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(node.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
