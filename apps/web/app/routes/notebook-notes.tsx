'use client';

import { type NoteIndex, noteIdToUrl, parseNotebookId } from '@timenote/core';
import { Button, Card, CardContent, Input, Label } from '@timenote/ui';
import MarkdownEditor, {
  type MarkdownEditorRef,
} from '@timenote/ui/components/editor/markdown-editor';
import { PageHeader } from '@timenote/ui/components/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@timenote/ui/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@timenote/ui/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@timenote/ui/components/ui/dropdown-menu';
import {
  Calendar,
  Maximize2,
  MoreVertical,
  PlusSquare,
  Search as SearchIcon,
  SendHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useVaultStore } from '~/lib/vault-store';

export default function VaultTimelinePage() {
  const { notebookToken } = useParams();
  const projectId = parseNotebookId(notebookToken || '');
  const { getNoteService } = useVaultStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [inputQuery, setInputQuery] = useState(q);
  const [searchQuery, setSearchQuery] = useState(q);

  const [notes, setNotes] = useState<NoteIndex[]>([]);
  const [composerContent, setComposerContent] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vaultName, setVaultName] = useState('');
  const [ready, setReady] = useState(false);

  const composerRef = useRef<MarkdownEditorRef>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);

  const loadNotes = useCallback(async () => {
    try {
      const svc = useVaultStore.getState().getNoteService();
      const list = searchQuery
        ? await svc.searchNotes(searchQuery)
        : await svc.listNotes({ limit: 100 });
      setNotes(list);
    } catch (e) {
      toast.error(`Failed to load notes: ${(e as Error).message}`);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const init = async () => {
      try {
        await useVaultStore.getState().init();
        await useVaultStore.getState().activateVault(projectId);
        const { createVaultService: cvs } = await import('@timenote/core/vault');
        const vaultService = await cvs();
        const manifest = await vaultService.readManifest(projectId);
        if (cancelled) return;
        setVaultName(manifest.name);
        setReady(true);
        const svc = useVaultStore.getState().getNoteService();
        const list = searchQuery
          ? await svc.searchNotes(searchQuery)
          : await svc.listNotes({ limit: 100 });
        if (cancelled) return;
        setNotes(list);
      } catch (e) {
        if (!cancelled) toast.error(`Failed to activate vault: ${(e as Error).message}`);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [projectId, searchQuery]);

  useEffect(() => {
    const query = searchParams.get('q') || '';
    setSearchQuery(query);
    setInputQuery(query);
  }, [searchParams]);

  const syncTagsToMenu = async (content: string) => {
    if (!projectId) return;
    const hashtagRegex = /#([\w\u4e00-\u9fa5]+)/g;
    const matches = content.matchAll(hashtagRegex);
    const tagNames = Array.from(new Set(Array.from(matches).map((m) => m[1])));
    if (tagNames.length === 0) return;

    const currentItems = useVaultStore.getState().menuItems;
    const existingSearches = new Set(
      currentItems.filter((i) => i.type === 'search').map((i) => i.search),
    );

    const store = useVaultStore.getState();
    for (const tag of tagNames) {
      if (!existingSearches.has(`#${tag}`)) {
        await store.addMenuItem(projectId, {
          parentId: null,
          title: tag,
          type: 'search',
          search: `#${tag}`,
        });
      }
    }
  };

  const handleComposerSubmit = async () => {
    if (!composerContent.trim() || !projectId) return;
    try {
      const svc = getNoteService();
      await svc.createNote(projectId, composerContent);
      await syncTagsToMenu(composerContent);
      setComposerContent('');
      composerRef.current?.setMarkdown('');
      composerRef.current?.focus();
      await loadNotes();
    } catch (e) {
      toast.error(`Failed to create note: ${(e as Error).message}`);
    }
  };

  const handleUpdate = async (noteId: string, content: string) => {
    if (!projectId) return;
    try {
      const svc = getNoteService();
      await svc.updateNote(projectId, noteId, content);
      await syncTagsToMenu(content);
      setEditingId(null);
      await loadNotes();
    } catch (e) {
      toast.error(`Failed to update note: ${(e as Error).message}`);
    }
  };

  const handleDelete = async () => {
    if (!noteToDelete || !projectId) return;
    try {
      const svc = getNoteService();
      await svc.deleteNote(projectId, noteToDelete);
      setNoteToDelete(null);
      setIsDeleteDialogOpen(false);
      toast.success('Note deleted');
      await loadNotes();
    } catch (e) {
      toast.error(`Failed to delete note: ${(e as Error).message}`);
    }
  };

  const handleAddToMenu = async () => {
    if (!menuNoteId || !menuName.trim() || !projectId) return;
    try {
      await useVaultStore.getState().addMenuItem(projectId, {
        parentId: null,
        title: menuName,
        type: 'note',
        note_id: menuNoteId,
      });
      setIsMenuDialogOpen(false);
      setMenuNoteId(null);
      setMenuName('');
      toast.success('Added to menu');
    } catch (e) {
      toast.error(`Failed to add to menu: ${(e as Error).message}`);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearchQuery(inputQuery);
    if (inputQuery) {
      setSearchParams({ q: inputQuery });
    } else {
      setSearchParams({});
    }
  };

  const loadBody = async (noteId: string): Promise<string> => {
    if (!projectId) return '';
    const svc = getNoteService();
    const note = await svc.getNote(projectId, noteId);
    return note?.body ?? '';
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={searchQuery ? `Search: ${searchQuery}` : vaultName || 'Notes'}>
        <div className="flex items-center gap-1 w-full justify-end" style={{ maxWidth: '320px' }}>
          <form onSubmit={handleSearchSubmit} className="relative group w-full">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search...."
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
      </PageHeader>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">
        <Card className="border-none shadow-sm overflow-hidden bg-card">
          <CardContent className="p-0">
            <div className="p-4 focus-within:ring-0 transition-all">
              <MarkdownEditor
                key={projectId}
                ref={composerRef}
                initialValue={composerContent}
                onChange={setComposerContent}
                placeholder="What's on your mind?"
                minHeight="100px"
                showToolbar={false}
                className="text-lg bg-transparent border-none shadow-none p-0"
                onSubmit={handleComposerSubmit}
              />
              <div className="flex justify-end items-center mt-3 pt-3 border-t border-muted/20">
                <Button
                  onClick={handleComposerSubmit}
                  disabled={!composerContent.trim()}
                  className="rounded-full w-12"
                  size="sm"
                >
                  <SendHorizontal strokeWidth={3} className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 pb-20">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              notebookToken={notebookToken || ''}
              editingId={editingId}
              setEditingId={setEditingId}
              editorRef={editorRef}
              onLoadBody={loadBody}
              onUpdate={handleUpdate}
              onDelete={(id) => {
                setNoteToDelete(id);
                setIsDeleteDialogOpen(true);
              }}
              onAddToMenu={(id) => {
                setMenuNoteId(id);
                setMenuName('');
                setIsMenuDialogOpen(true);
              }}
            />
          ))}

          {notes.length === 0 && (
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
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isMenuDialogOpen} onOpenChange={setIsMenuDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note to Menu</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddToMenu();
            }}
          >
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
              <Button type="button" variant="outline" onClick={() => setIsMenuDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NoteCard({
  note,
  notebookToken,
  editingId,
  setEditingId,
  editorRef,
  onLoadBody,
  onUpdate,
  onDelete,
  onAddToMenu,
}: {
  note: NoteIndex;
  notebookToken: string;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  editorRef: React.RefObject<MarkdownEditorRef | null>;
  onLoadBody: (id: string) => Promise<string>;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => void;
  onAddToMenu: (id: string) => void;
}) {
  const [body, setBody] = useState<string | null>(null);
  const isEditing = editingId === note.id;

  useEffect(() => {
    if (!isEditing && body === null) {
      onLoadBody(note.id).then(setBody);
    }
  }, [note.id, isEditing, body, onLoadBody]);

  useEffect(() => {
    if (isEditing && body === null) {
      onLoadBody(note.id).then(setBody);
    }
  }, [isEditing, body, note.id, onLoadBody]);

  return (
    <Card className="group overflow-hidden transition-all duration-300 border-muted/60 hover:shadow-md hover:border-muted-foreground/20">
      <div className="px-5 py-3 border-b border-muted/40 flex justify-between items-center bg-muted/20">
        <div className="flex items-center gap-4">
          <Link
            to={`/s/${notebookToken}/${noteIdToUrl(note.id)}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium hover:text-primary transition-colors cursor-pointer"
            suppressHydrationWarning
          >
            <Calendar className="w-3.5 h-3.5 opacity-70" />
            {new Date(note.updated_at).toLocaleString([], {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </Link>
          {note.tags.length > 0 && (
            <div className="flex gap-1">
              {note.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
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
                <Link to={`/s/${notebookToken}/${noteIdToUrl(note.id)}`} className="cursor-pointer">
                  <Maximize2 className="w-4 h-4 mr-2" /> Full Screen
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddToMenu(note.id)}>
                <PlusSquare className="w-4 h-4 mr-2" /> Add to menu
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(note.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CardContent className="p-0">
        {isEditing ? (
          <div className="p-4 space-y-4">
            {body !== null && (
              <MarkdownEditor
                key={`edit-${note.id}`}
                ref={editorRef}
                initialValue={body}
                onSubmit={() => {
                  const content = editorRef.current?.getMarkdown() || '';
                  onUpdate(note.id, content);
                }}
                autoFocus
                minHeight="200px"
                className="text-base"
              />
            )}
            <div className="flex justify-between items-center pt-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-sans">⌘</kbd>
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-sans">Enter</kbd>
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
                    onUpdate(note.id, content);
                  }}
                  className="rounded-full w-12"
                >
                  <SendHorizontal strokeWidth={3} className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditingId(note.id)}
            className="cursor-text p-6 min-h-[100px] hover:bg-accent/5 transition-colors w-full text-left block"
          >
            {body !== null ? (
              <MarkdownEditor
                key={`view-${note.id}`}
                initialValue={body}
                editable={false}
                className="text-base"
              />
            ) : (
              <div className="text-muted-foreground text-sm">Loading...</div>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
