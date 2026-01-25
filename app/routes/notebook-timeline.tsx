"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { Link, useParams, useSearchParams, type MetaFunction } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { NoteService } from "../lib/services/note-service";
import { MenuService } from "../lib/services/menu-service";
import { filterNotes } from "../lib/utils/search";
import MarkdownEditor, { type MarkdownEditorRef } from "../components/editor/markdown-editor";
import { db, type Note } from "../lib/db";
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
  Calendar,
  Hash,
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

export const meta: MetaFunction = () => {
  return [{ title: "Time Note" }];
};

export default function NotebookTimeline() {
  const { notebookId } = useParams();
  const [searchParams] = useSearchParams();
  const nbId = notebookId || "";
  const q = searchParams.get("q") || "";
  
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
  const [composerContent, setComposerContent] = useState("");
  const editorRef = useRef<MarkdownEditorRef>(null);

  useEffect(() => {
    if (searchParams.has("q")) {
      setSearchQuery(q);
      setTargetNoteId(null);
      setSelectedTagId(null);
    }
  }, [q, searchParams]);

  // Dialog states
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState("");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

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

  const handleUpdate = async (id: string, content: string) => {
    await NoteService.updateNote(id, content);
  };

  const handleSyncTags = async (id: string, content: string) => {
    await NoteService.syncNoteTagsFromContent(id, nbId, content);
  };

  const handleDelete = (id: string) => {
    setNoteToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (noteToDelete) {
      await NoteService.deleteNote(noteToDelete);
      setNoteToDelete(null);
      setIsDeleteDialogOpen(false);
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

  const handleComposerSubmit = async () => {
    if (!composerContent.trim()) return;
    const id = await NoteService.createNote(nbId);
    await NoteService.updateNote(id, composerContent);
    await NoteService.syncNoteTagsFromContent(id, nbId, composerContent);
    setComposerContent("");
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
        {/* Sticky Header with Search */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-muted/20 px-4 py-3">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h2 className="text-lg font-bold truncate pr-4">
              {targetNoteId ? "Note Details" : (selectedTagId ? `Notes with #${notebookTags?.find(t => t.id === selectedTagId)?.name}` : (searchQuery ? "Search Results" : notebook.name))}
            </h2>
            
            <div className="relative group w-full max-w-[240px]">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search..."
                className="pl-9 h-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all rounded-full text-sm"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setTargetNoteId(null);
                }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-full text-muted-foreground transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">


          {/* New Note Section (Composer) */}
          {!targetNoteId && (
            <Card className="border-none shadow-sm overflow-hidden bg-card">
              <CardContent className="p-0">
                <div className="p-4 focus-within:ring-0 transition-all">
                  <MarkdownEditor
                    key={nbId + (composerContent === "" ? "empty" : "active")}
                    initialValue={composerContent}
                    onChange={setComposerContent}
                    placeholder="What's on your mind? Use #tags to organize..."
                    availableTags={availableTagNames}
                    minHeight="100px"
                    showToolbar={false}
                    className="text-lg bg-transparent border-none shadow-none p-0"
                    onSubmit={handleComposerSubmit}
                  />
                  <div className="flex justify-end items-center mt-3 pt-3 border-t border-muted/20">
                    <Button 
                      onClick={handleComposerSubmit} 
                      disabled={!composerContent.trim()}
                      className="rounded-full px-6 font-bold"
                      size="sm"
                    >
                      Post
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4 pb-20">
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
                          <Link to={`/s/${nbId}/${note.id}`} className="cursor-pointer">
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your note and remove its data from our local database.
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
