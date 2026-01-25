import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useLocation, useParams } from "react-router";
import { toast } from "sonner";
import { MenuService } from "~/lib/services/menu-service";
import { NoteService } from "~/lib/services/note-service";
import { createNotebookToken } from "~/lib/utils/token";
import { useTheme } from "./theme-provider";
import type { MenuItem } from "~/lib/db";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { 
  Plus, 
  ChevronRight, 
  Search, 
  FileText, 
  MoreVertical, 
  ArrowUp, 
  ArrowDown, 
  Edit2, 
  Trash2,
  FolderOpen,
  List,
  LayoutGrid,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Book,
  Tag
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

interface NotebookSidebarProps {
  notebookId: string;
  onSelectSearch: (query: string, menuItemId?: string) => void;
  onSelectNote: (noteId: string, menuItemId?: string) => void;
  selectedItemId?: string;
}

export function NotebookSidebar({ 
  notebookId, 
  onSelectSearch, 
  onSelectNote,
  selectedItemId 
}: NotebookSidebarProps) {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { notebookToken } = useParams();
  const notebooks = useLiveQuery(() => NoteService.getAllNotebooks()) || [];
  const currentNotebook = notebooks.find(nb => nb.id === notebookId);

  const isTagsPage = location.pathname.endsWith("/tags");
  const isAllNotesPage = !selectedItemId && !isTagsPage && location.pathname === `/s/${notebookToken}`;
  
  const menuItems = useLiveQuery(() => MenuService.getMenuItemsByNotebook(notebookId), [notebookId]) || [];
  const tree = buildTree(menuItems);

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

  const handleOpenAdd = (parentId: string | null = null) => {
    setEditingItem({
      parentId,
      name: "",
      type: "search",
      target: "",
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
        toast.success("Menu item updated");
      } else {
        await MenuService.createMenuItem({
          notebookId,
          parentId: editingItem.parentId,
          name: editingItem.name,
          type: editingItem.type,
          target: editingItem.target,
          order: menuItems.length,
        });
        toast.success("Menu item created");
      }
      setDialogOpen(false);
      setEditingItem(null);
    } catch (error) {
      toast.error("Failed to save menu item");
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
        toast.success("Menu item deleted");
      } catch (error) {
        toast.error("Failed to delete menu item");
      }
    }
  };

  const moveUp = async (item: MenuItem) => {

    const siblings = menuItems.filter(i => i.parentId === item.parentId);
    const index = siblings.findIndex(i => i.id === item.id);
    if (index > 0) {
      const prev = siblings[index - 1];
      await MenuService.reorderMenuItems([
        { id: item.id, order: prev.order, parentId: item.parentId },
        { id: prev.id, order: item.order, parentId: item.parentId },
      ]);
    }
  };

  const moveDown = async (item: MenuItem) => {
    const siblings = menuItems.filter(i => i.parentId === item.parentId);
    const index = siblings.findIndex(i => i.id === item.id);
    if (index < siblings.length - 1) {
      const next = siblings[index + 1];
      await MenuService.reorderMenuItems([
        { id: item.id, order: next.order, parentId: item.parentId },
        { id: next.id, order: item.order, parentId: item.parentId },
      ]);
    }
  };

  return (
    <aside className="w-64 bg-sidebar border-r flex flex-col h-full shrink-0">
      <div className="p-3 flex justify-between items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="px-2 h-9 flex items-center gap-2 hover:bg-sidebar-accent/50 max-w-[180px] justify-start overflow-hidden">
              <Book className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold truncate text-sidebar-foreground">{currentNotebook?.name || "Notebook"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Switch Notebook
            </div>
            {notebooks.map(nb => (
              <DropdownMenuItem 
                key={nb.id} 
                onClick={() => navigate(`/s/${createNotebookToken(nb.id, nb.name)}`)}
                className={cn(nb.id === notebookId && "bg-sidebar-accent text-sidebar-accent-foreground")}
              >
                <Book className="w-4 h-4 mr-2" />
                <span className="truncate">{nb.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/")}>
              <List className="w-4 h-4 mr-2" />
              All Notebooks
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => handleOpenAdd(null)}
          className="h-8 w-8 text-muted-foreground shrink-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1 w-full max-w-full overflow-hidden">
          <div 
            className={cn(
              "group flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors cursor-pointer text-sm font-medium",
              isAllNotesPage
                ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
            onClick={() => onSelectSearch("")}
          >
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <div className="w-4" />
              <LayoutGrid className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">All Notes</span>
            </div>
          </div>

          <div 
            className={cn(
              "group flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors cursor-pointer text-sm font-medium",
              isTagsPage
                ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
            onClick={() => navigate(`/s/${notebookToken}/tags`)}
          >
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <div className="w-4" />
              <Tag className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">Tags</span>
            </div>
          </div>

          <Separator className="my-2 bg-sidebar-border/50" />

          {tree.map(node => (
            <MenuItemComponent 
              key={node.id} 
              node={node} 
              level={0}
              onSelectNote={onSelectNote}
              onSelectSearch={onSelectSearch}
              onAddChild={handleOpenAdd}
              onUpdate={handleOpenEdit}
              onDelete={handleDelete}
              onMoveUp={moveUp}
              onMoveDown={moveDown}
              selectedItemId={selectedItemId}
            />
          ))}
          {menuItems.length === 0 && (
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 h-9 px-2 text-sidebar-foreground focus-visible:ring-0 focus-visible:ring-offset-0">
              {theme === "light" && <Sun className="w-4 h-4" />}
              {theme === "dark" && <Moon className="w-4 h-4" />}
              {theme === "system" && <Monitor className="w-4 h-4" />}
              <span className="capitalize">{theme} Theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-40">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="w-4 h-4 mr-2" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="w-4 h-4 mr-2" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="w-4 h-4 mr-2" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingItem?.id ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
          </DialogHeader>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the menu item and all its sub-menu items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

interface TreeNode extends MenuItem {
  children: TreeNode[];
}

function buildTree(items: MenuItem[]): TreeNode[] {
  const itemMap: Record<string, TreeNode> = {};
  const rootNodes: TreeNode[] = [];

  items.forEach(item => {
    itemMap[item.id] = { ...item, children: [] };
  });

  items.forEach(item => {
    if (item.parentId && itemMap[item.parentId]) {
      itemMap[item.parentId].children.push(itemMap[item.id]);
    } else {
      rootNodes.push(itemMap[item.id]);
    }
  });

  return rootNodes;
}

function MenuItemComponent({ 
  node, 
  level,
  onSelectNote,
  onSelectSearch,
  onAddChild,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  selectedItemId
}: { 
  node: TreeNode; 
  level: number;
  onSelectNote: (id: string, menuItemId?: string) => void;
  onSelectSearch: (q: string, menuItemId?: string) => void;
  onAddChild: (id: string) => void;
  onUpdate: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  onMoveUp: (item: MenuItem) => void;
  onMoveDown: (item: MenuItem) => void;
  selectedItemId?: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = selectedItemId === node.id;

  return (
    <div className="space-y-1">
      <div 
        className={cn(
          "group flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors cursor-pointer text-sm font-medium w-full max-w-full overflow-hidden",
          isSelected 
            ? "bg-sidebar-accent text-sidebar-accent-foreground" 
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
        style={{ paddingLeft: `${level * 0.5 + 0.5}rem` }}
        onClick={() => {
          if (node.type === 'note') onSelectNote(node.target, node.id);
          else onSelectSearch(node.target, node.id);
        }}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          {node.children.length > 0 ? (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-4 w-4 p-0 hover:bg-transparent flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
            >
              <ChevronRight className={cn("w-3 h-3 transition-transform", isOpen && "rotate-90")} />
            </Button>
          ) : (
            <div className="w-4 flex-shrink-0" />
          )}
          
          {node.type === 'search' ? (
            <Search className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
          )}
          
          <span className="truncate text-ellipsis overflow-hidden whitespace-nowrap">{node.name}</span>
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 ml-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 ml-1">
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
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(node.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {isOpen && node.children.length > 0 && (
        <div className="space-y-1">
          {node.children.map(child => (
            <MenuItemComponent 
              key={child.id} 
              node={child} 
              level={level + 1}
              onSelectNote={onSelectNote}
              onSelectSearch={onSelectSearch}
              onAddChild={onAddChild}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              selectedItemId={selectedItemId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
