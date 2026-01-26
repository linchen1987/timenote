'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import {
  Calendar,
  CloudDownload,
  Maximize2,
  MoreVertical,
  Plus,
  PlusSquare,
  RefreshCw,
  Search as SearchIcon,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import MarkdownEditor, { type MarkdownEditorRef } from '~/components/editor/markdown-editor';
import { NoteTagsView } from '~/components/note-tags-view';
import { NotebookSidebar } from '~/components/notebook-sidebar';
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
import { Card, CardContent } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { MenuService } from '~/lib/services/menu-service';
import { NoteService } from '~/lib/services/note-service';
import { SyncService } from '~/lib/services/sync-service';
import type { Note } from '~/lib/types';
import { cn } from '~/lib/utils';
import { getNotebookMeta } from '~/lib/utils/pwa';
import { filterNotes } from '~/lib/utils/search';
import { parseNotebookId } from '~/lib/utils/token';
import type { Route } from './+types/notebook-timeline';

export const meta: Route.MetaFunction = ({ params }) => {
  return getNotebookMeta('Time Note', params.notebookToken);
};

export default function NotebookTimeline() {
  const { notebookToken } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const nbId = parseNotebookId(notebookToken || '');
  const q = searchParams.get('q') || '';

  // State for pagination
  const [limit, setLimit] = useState(20);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Search states
  const [searchQuery, setSearchQuery] = useState(q);
  const [inputQuery, setInputQuery] = useState(q);

  // Editor and selection states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [targetNoteId, setTargetNoteId] = useState<string | null>(null);
  const [activeMenuItemId, setActiveMenuItemId] = useState<string | undefined>(undefined);
  const [composerContent, setComposerContent] = useState('');
  const editorRef = useRef<MarkdownEditorRef>(null);

  // Dialog states
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);

  // Queries
  const notebook = useLiveQuery(() => NoteService.getNotebook(nbId), [nbId]);

  // Global search query
  const allNotesForSearch = useLiveQuery(
    () => (searchQuery ? NoteService.getNotesByNotebook(nbId) : Promise.resolve([])),
    [searchQuery, nbId],
  );

  const notebookNotes = useLiveQuery(
    () => (searchQuery ? Promise.resolve([]) : NoteService.getNotesByNotebook(nbId, limit)),
    [nbId, limit, searchQuery],
  );

  const totalCount = useLiveQuery(
    () => (searchQuery ? Promise.resolve(0) : NoteService.getNoteCountByNotebook(nbId)),
    [nbId, searchQuery],
  );

  const notebookTags = useLiveQuery(() => NoteService.getTagsByNotebook(nbId), [nbId]);

  // Sync searchQuery with URL params
  useEffect(() => {
    if (searchParams.has('q')) {
      const query = searchParams.get('q') || '';
      setSearchQuery(query);
      setInputQuery(query);
      setTargetNoteId(null);
      setSelectedTagId(null);
    }
  }, [searchParams]);

  // Infinite scroll observer
  const hasMore =
    !searchQuery &&
    totalCount !== undefined &&
    notebookNotes !== undefined &&
    notebookNotes.length < totalCount;
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setLimit((prev) => prev + 20);
        }
      },
      { threshold: 0.1 },
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  // Note tags mapping
  const noteTagNamesMap = useLiveQuery(NoteService.getNoteTagNamesMap, []);

  const filteredNotes = useMemo(() => {
    if (targetNoteId) {
      const source = searchQuery ? allNotesForSearch : notebookNotes;
      return (source || []).filter((note) => note.id === targetNoteId);
    }

    if (searchQuery) {
      return filterNotes(
        (allNotesForSearch as (Note & { content: string; id: string })[]) || [],
        searchQuery,
        noteTagNamesMap,
      );
    }

    let result = notebookNotes || [];
    if (selectedTagId && noteTagNamesMap) {
      const tag = notebookTags?.find((t) => t.id === selectedTagId);
      if (tag) {
        result = result.filter((note) => noteTagNamesMap[note.id!]?.includes(tag.name));
      }
    }
    return result;
  }, [
    notebookNotes,
    allNotesForSearch,
    searchQuery,
    selectedTagId,
    noteTagNamesMap,
    targetNoteId,
    notebookTags,
  ]);

  // Handlers
  const handleUpdate = async (id: string, content: string) => {
    await NoteService.updateNoteWithTags(id, nbId, content);
  };

  const handleDelete = (id: string) => {
    setNoteToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (noteToDelete) {
      try {
        await NoteService.deleteNote(noteToDelete);
        setNoteToDelete(null);
        setIsDeleteDialogOpen(false);
        toast.success('Note deleted successfully');
      } catch (_error) {
        toast.error('Failed to delete note');
      }
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await SyncService.syncNotebook(nbId);
      toast.success('Synced successfully');
    } catch (e) {
      console.error(e);
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePull = async () => {
    setIsSyncing(true);
    try {
      await SyncService.pull(nbId);
      toast.success('Pulled successfully');
    } catch (e) {
      console.error(e);
      toast.error('Pull failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearchQuery(inputQuery);
    setTargetNoteId(null);
    setSelectedTagId(null);
    if (inputQuery) {
      setSearchParams({ q: inputQuery });
    } else {
      setSearchParams({});
    }
  };

  const handleSelectSearch = (query: string, menuItemId?: string) => {
    setSearchQuery(query);
    setInputQuery(query);
    setTargetNoteId(null);
    setSelectedTagId(null);
    setActiveMenuItemId(menuItemId);
    if (query) setSearchParams({ q: query });
    else setSearchParams({});
  };

  const handleSelectNote = (noteId: string, menuItemId?: string) => {
    setTargetNoteId(noteId);
    setSearchQuery('');
    setInputQuery('');
    setSelectedTagId(null);
    setActiveMenuItemId(menuItemId);
    setSearchParams({});
  };

  const handleAddToMenu = async () => {
    if (!menuNoteId || !menuName.trim()) return;
    try {
      await MenuService.createMenuItem({
        notebookId: nbId,
        parentId: null,
        name: menuName,
        type: 'note',
        target: menuNoteId,
        order: 0,
      });
      setIsMenuDialogOpen(false);
      setMenuNoteId(null);
      setMenuName('');
      toast.success('Added to menu');
    } catch (_error) {
      toast.error('Failed to add to menu');
    }
  };

  const handleComposerSubmit = async () => {
    if (!composerContent.trim()) return;
    try {
      await NoteService.createNoteWithContent(nbId, composerContent);
      setComposerContent('');
      toast.success('Note posted successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to post note');
    }
  };

  if (!notebook) return null;
  const availableTagNames = (notebookTags || []).map((t) => t.name);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <NotebookSidebar
        notebookId={nbId}
        onSelectSearch={handleSelectSearch}
        onSelectNote={handleSelectNote}
        selectedItemId={activeMenuItemId}
      />

      <main className="flex-1 overflow-y-auto scroll-smooth">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-muted/20 px-4 py-3">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h2 className="text-lg font-bold truncate pr-4">
              {targetNoteId
                ? 'Note Details'
                : selectedTagId
                  ? `Notes with #${notebookTags?.find((t) => t.id === selectedTagId)?.name}`
                  : searchQuery
                    ? `Search: ${searchQuery}`
                    : notebook.name}
            </h2>

            <div className="flex items-center gap-1 w-full max-w-[320px] justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePull}
                disabled={isSyncing}
                title="Pull from Cloud (Download Only)"
                className="shrink-0 text-muted-foreground hover:text-primary"
              >
                <CloudDownload className={cn('w-4 h-4', isSyncing && 'animate-pulse')} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSync}
                disabled={isSyncing}
                title="Sync Notebook (Push & Pull)"
                className="shrink-0 mr-2 text-muted-foreground hover:text-primary"
              >
                <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
              </Button>
              <form onSubmit={handleSearchSubmit} className="relative group w-full">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search..."
                  className="pl-9 h-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all rounded-full text-sm"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                />
                {inputQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputQuery('');
                      setSearchQuery('');
                      setSearchParams({});
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-full text-muted-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </form>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
          {!targetNoteId && !searchQuery && (
            <Card className="border-none shadow-sm overflow-hidden bg-card">
              <CardContent className="p-0">
                <div className="p-4 focus-within:ring-0 transition-all">
                  <MarkdownEditor
                    key={nbId + (composerContent === '' ? 'empty' : 'active')}
                    initialValue={composerContent}
                    onChange={setComposerContent}
                    placeholder="What's on your mind?"
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
                  'group overflow-hidden transition-all duration-300 border-muted/60',
                  editingId === note.id
                    ? 'ring-2 ring-primary/20 border-primary/30'
                    : 'hover:shadow-md hover:border-muted-foreground/20',
                )}
              >
                <div className="px-5 py-3 border-b border-muted/40 flex justify-between items-center bg-muted/20">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Calendar className="w-3.5 h-3.5 opacity-70" />
                      {new Date(note.updatedAt).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </div>
                    <NoteTagsView noteId={note.id!} />
                  </div>
                  <div className="flex gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link to={`/s/${notebookToken}/${note.id}`} className="cursor-pointer">
                            <Maximize2 className="w-4 h-4 mr-2" /> Full Screen
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setMenuNoteId(note.id!);
                            setMenuName(`Menu for Note ${note.id?.slice(0, 4)}`);
                            setIsMenuDialogOpen(true);
                          }}
                        >
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
                        key={`edit-${note.id}`}
                        ref={editorRef}
                        initialValue={note.content}
                        onSubmit={() => {
                          const content = editorRef.current?.getMarkdown() || '';
                          handleUpdate(note.id!, content);
                          setEditingId(null);
                        }}
                        availableTags={availableTagNames}
                        autoFocus
                        minHeight="200px"
                      />
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-2">
                          <kbd className="px-1.5 py-0.5 rounded border bg-muted font-sans">⌘</kbd>
                          <kbd className="px-1.5 py-0.5 rounded border bg-muted font-sans">
                            Enter
                          </kbd>
                          to save
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                            className="rounded-full"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const content = editorRef.current?.getMarkdown() || '';
                              handleUpdate(note.id!, content);
                              setEditingId(null);
                            }}
                            className="rounded-full"
                          >
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDoubleClick={() => setEditingId(note.id!)}
                      className="cursor-text p-6 min-h-[100px] hover:bg-accent/5 transition-colors"
                    >
                      <MarkdownEditor
                        key={`view-${note.id}`}
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

            {filteredNotes?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <SearchIcon className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold">No notes found</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  {searchQuery
                    ? `We couldn't find any notes matching "${searchQuery}".`
                    : 'This notebook is empty.'}
                </p>
                {searchQuery && (
                  <Button
                    variant="link"
                    onClick={() => {
                      setInputQuery('');
                      setSearchQuery('');
                      setSearchParams({});
                    }}
                    className="mt-2"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            )}

            <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
              {hasMore && (
                <div className="flex items-center gap-2 text-muted-foreground animate-pulse text-sm">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading more...
                </div>
              )}
            </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMenuDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddToMenu}>Create Menu Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your note and remove its
              data from our local database.
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
    </div>
  );
}
