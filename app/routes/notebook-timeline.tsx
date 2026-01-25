"use client";

import { useState, useRef, useMemo } from "react";
import { Link, useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { NoteService } from "../lib/services/note-service";
import { MenuService } from "../lib/services/menu-service";
import { filterNotes } from "../lib/utils/search";
import MarkdownEditor, { type MarkdownEditorRef } from "../components/editor/markdown-editor";
import { db, type Tag, type Note } from "../lib/db";
import { NotebookSidebar } from "../components/notebook-sidebar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent } from "~/components/ui/card";
import { 
  Plus, 
  Search as SearchIcon, 
  Trash2, 
  Maximize2, 
  X, 
  ArrowLeft,
  Calendar,
  Hash,
  FileText,
  MoreVertical,
  PlusSquare
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";

export default function NotebookTimeline() {
  const { notebookId } = useParams();
  const nbId = notebookId || "";
  
  const notebook = useLiveQuery(() => NoteService.getNotebook(nbId), [nbId]);
  const notes = useLiveQuery(
    () => NoteService.getNotesByNotebook(nbId),
    [nbId]
  );
  const notebookTags = useLiveQuery(() => NoteService.getTagsByNotebook(nbId), [nbId]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [targetNoteId, setTargetNoteId] = useState<string | null>(null);
  const [activeMenuItemId, setActiveMenuItemId] = useState<string | undefined>(undefined);
  const editorRef = useRef<MarkdownEditorRef>(null);

  // Add to menu dialog state
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState("");

  // 获取每条笔记关联的标签名称映射
  const noteTagNamesMap = useLiveQuery(async () => {
    const associations = await db.noteTags.toArray();
    const tags = await db.tags.toArray();
    const tagIdToName = Object.fromEntries(tags.map(t => [t.id, t.name]));
    
    const map: Record<string, string[]> = {};
    associations.forEach(a => {
      if (!map[a.noteId]) map[a.noteId] = [];
      const tagName = tagIdToName[a.tagId];
      if (tagName) map[a.noteId].push(tagName);
    });
    return map;
  }, [notes, notebookTags]);

  const filteredNotes = useMemo(() => {
    let result = notes || [];
    
    // 如果指定了目标笔记
    if (targetNoteId) {
      return result.filter(note => note.id === targetNoteId);
    }

    // 标签过滤
    if (selectedTagId && noteTagNamesMap) {
      const tag = notebookTags?.find(t => t.id === selectedTagId);
      if (tag) {
        result = result.filter(note => noteTagNamesMap[note.id!]?.includes(tag.name));
      }
    }

    // 搜索过滤
    return filterNotes(result as (Note & { content: string; id: string })[], searchQuery, noteTagNamesMap);
  }, [notes, searchQuery, selectedTagId, noteTagNamesMap, targetNoteId, notebookTags]);

  const handleCreate = async () => {
    const id = await NoteService.createNote(nbId);
    setEditingId(id);
  };

  const handleUpdate = async (id: string, content: string) => {
    await NoteService.updateNote(id, content);
  };

  const handleSyncTags = async (id: string, content: string) => {
    await NoteService.syncNoteTagsFromContent(id, nbId, content);
  };

  const handleDelete = async (id: string) => {
    if (confirm("确定要删除这条笔记吗？")) {
      await NoteService.deleteNote(id);
    }
  };

  const handleSelectSearch = (query: string, menuItemId?: string) => {
    setSearchQuery(query);
    setTargetNoteId(null);
    setSelectedTagId(null);
    setActiveMenuItemId(menuItemId);
  };

  const handleSelectNote = (noteId: string, menuItemId?: string) => {
    setTargetNoteId(noteId);
    setSearchQuery("");
    setSelectedTagId(null);
    setActiveMenuItemId(menuItemId);
  };

  const handleAddToMenu = async () => {
    if (!menuNoteId || !menuName.trim()) return;
    
    await MenuService.createMenuItem({
      notebookId: nbId,
      parentId: null,
      name: menuName,
      type: 'note',
      target: menuNoteId,
      order: 0, // Will be handled by service if we want auto-ordering, but 0 is fine for now
    });
    
    setIsMenuDialogOpen(false);
    setMenuNoteId(null);
    setMenuName("");
  };

  if (!notebook) return null;

  const availableTagNames = (notebookTags || []).map(t => t.name);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <NotebookSidebar 
        notebookId={nbId} 
        onSelectSearch={handleSelectSearch} 
        onSelectNote={handleSelectNote}
        selectedItemId={activeMenuItemId}
      />
      
      <main className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                <Link to="/" className="hover:text-primary flex items-center gap-1 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> All Notebooks
                </Link>
              </nav>
              <h1 className="text-3xl font-bold tracking-tight">
                {notebook.name}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                <span>ID: {nbId}</span>
                <span>•</span>
                <span>{notes?.length || 0} Notes</span>
              </div>
            </div>
            <Button onClick={handleCreate} className="rounded-full shadow-md hover:shadow-lg transition-all gap-2 px-6">
              <Plus className="w-4 h-4" /> New Note
            </Button>
          </header>

          <div className="flex flex-col gap-4">
            {/* 搜索过滤栏 */}
            <div className="relative group">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search notes or use #tag..."
                className="pl-10 h-11 bg-muted/50 border-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all rounded-xl"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setTargetNoteId(null);
                }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full text-muted-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 标签过滤栏 */}
            {notebookTags && notebookTags.length > 0 && (
              <div className="flex flex-wrap gap-2 py-1">
                <Button
                  variant={!selectedTagId && !targetNoteId ? "default" : "secondary"}
                  size="sm"
                  onClick={() => {
                    setSelectedTagId(null);
                    setTargetNoteId(null);
                  }}
                  className="rounded-full text-xs h-7"
                >
                  All
                </Button>
                {notebookTags.map(tag => (
                  <Button
                    key={tag.id}
                    variant={tag.id === selectedTagId ? "default" : "secondary"}
                    size="sm"
                    onClick={() => {
                      setSelectedTagId(tag.id === selectedTagId ? null : tag.id);
                      setTargetNoteId(null);
                    }}
                    className="rounded-full text-xs h-7 gap-1"
                  >
                    <Hash className="w-3 h-3 opacity-70" /> {tag.name}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6 pb-20">
            {filteredNotes?.map((note) => (
              <Card 
                key={note.id} 
                className={cn(
                  "group overflow-hidden transition-all duration-300 border-muted/60",
                  editingId === note.id ? "ring-2 ring-primary/20 border-primary/30" : "hover:shadow-md hover:border-muted-foreground/20"
                )}
              >
                <div className="px-5 py-3 border-b border-muted/40 flex justify-between items-center bg-muted/20">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Calendar className="w-3.5 h-3.5 opacity-70" />
                      {new Date(note.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    <NoteTagsView noteId={note.id!} />
                  </div>
                  <div className="flex gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link to={`/notebooks/${nbId}/${note.id}`} className="cursor-pointer">
                            <Maximize2 className="w-4 h-4 mr-2" /> Full Screen
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setMenuNoteId(note.id!);
                          setMenuName(`Menu for Note ${note.id!.slice(0, 4)}`);
                          setIsMenuDialogOpen(true);
                        }}>
                          <PlusSquare className="w-4 h-4 mr-2" /> Add to menu
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(note.id!)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                
                <CardContent className="p-0">
                  {editingId === note.id ? (
                    <div className="p-4 space-y-4">
                      <MarkdownEditor
                        ref={editorRef}
                        initialValue={note.content}
                        onChange={(val) => handleUpdate(note.id!, val)}
                        onBlur={(val) => {
                          handleSyncTags(note.id!, val);
                          setEditingId(null);
                        }}
                        onSubmit={() => {
                          const content = editorRef.current?.getMarkdown() || "";
                          handleSyncTags(note.id!, content);
                          setEditingId(null);
                        }}
                        availableTags={availableTagNames}
                        autoFocus
                        minHeight="200px"
                      />
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-2">
                          <kbd className="px-1.5 py-0.5 rounded border bg-muted font-sans">⌘</kbd>
                          <kbd className="px-1.5 py-0.5 rounded border bg-muted font-sans">Enter</kbd>
                          to save
                        </span>
                        <Button 
                          size="sm"
                          onClick={() => {
                            const content = editorRef.current?.getMarkdown() || "";
                            handleSyncTags(note.id!, content);
                            setEditingId(null);
                          }}
                          className="rounded-full"
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setEditingId(note.id!)}
                      className="cursor-text p-6 min-h-[100px] hover:bg-accent/5 transition-colors"
                    >
                      <MarkdownEditor
                        initialValue={note.content}
                        editable={false}
                      />
                      {!note.content && (
                        <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                          <Plus className="w-8 h-8 mb-2 opacity-20" />
                          <span className="italic text-sm">Empty note, click to write...</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            
            {notes?.length !== 0 && filteredNotes?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <SearchIcon className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold">No notes found</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  We couldn't find any notes matching "{searchQuery}". Try a different search term.
                </p>
                <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2">
                  Clear search
                </Button>
              </div>
            )}
            
            {notes?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold">Your notebook is empty</h3>
                <p className="text-muted-foreground max-w-xs mx-auto mb-6">
                  Start capturing your thoughts, ideas, or tasks in this notebook.
                </p>
                <Button onClick={handleCreate} size="lg" className="rounded-full gap-2 px-8">
                  <Plus className="w-5 h-5" /> Create your first note
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={isMenuDialogOpen} onOpenChange={setIsMenuDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note to Menu</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="menu-name">Menu Name</Label>
              <Input 
                id="menu-name" 
                value={menuName} 
                onChange={(e) => setMenuName(e.target.value)}
                placeholder="Enter menu name"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will create a new entry in your notebook's sidebar menu pointing directly to this note.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMenuDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddToMenu}>Create Menu Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoteTagsView({ noteId }: { noteId: string }) {
  const noteTags = useLiveQuery(() => NoteService.getTagsForNote(noteId), [noteId]);

  if (!noteTags || noteTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {noteTags.map(tag => (
        <span 
          key={tag.id} 
          className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5"
        >
          <Hash className="w-2.5 h-2.5 opacity-70" />
          {tag.name}
        </span>
      ))}
    </div>
  );
}
