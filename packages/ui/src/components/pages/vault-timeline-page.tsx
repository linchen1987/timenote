import {
  type AttachmentRef,
  type EditAttachment,
  extFromFilename,
  inferMimeFromExt,
  inferMimeFromPath,
  NOTE_LIST_PAGE_SIZE,
  type NoteIndex,
  noteIdToUrl,
  type PendingAttachment,
  parseNotebookId,
  type VaultStore,
} from '@timenote/core';
import {
  ArrowUpDown,
  Calendar,
  ImagePlus,
  Loader2,
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
import { AttachmentZone, attachmentRefToEditAttachment } from '../attachment/attachment-zone';
import MarkdownEditor, { type MarkdownEditorRef } from '../editor/markdown-editor';
import { PageHeader } from '../page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

type UseVaultStoreHook = {
  (): VaultStore;
  getState: () => VaultStore;
  <T>(selector: (s: VaultStore) => T): T;
};

export interface VaultTimelinePageProps {
  useStore: UseVaultStoreHook;
  headerMaxWidth?: string;
  linkExtraProps?: Record<string, unknown>;
}

export function VaultTimelinePage({
  useStore,
  headerMaxWidth = '360px',
  linkExtraProps,
}: VaultTimelinePageProps) {
  const { notebookToken } = useParams();
  const resolvedProjectId = parseNotebookId(notebookToken || '');
  const { getNoteService } = useStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [inputQuery, setInputQuery] = useState(q);
  const [searchQuery, setSearchQuery] = useState(q);

  const [notes, setNotes] = useState<NoteIndex[]>([]);
  const [bodiesMap, setBodiesMap] = useState<Map<string, string>>(new Map());
  const [totalCount, setTotalCount] = useState<number>(0);
  const [composerContent, setComposerContent] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vaultName, setVaultName] = useState('');
  const [attachmentsMap, setAttachmentsMap] = useState<Map<string, AttachmentRef[]>>(new Map());
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [composerAttachments, setComposerAttachments] = useState<EditAttachment[]>([]);
  const [editAttachments, setEditAttachments] = useState<EditAttachment[]>([]);
  const [editRemovedPaths, setEditRemovedPaths] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const isSyncing = useStore((s) => s.isSyncing);
  const lastSyncTime = useStore((s) => s.lastSyncTime);
  const noteVersion = useStore((s) => s.noteVersion);

  const composerRef = useRef<MarkdownEditorRef>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const composerFileInputRef = useRef<HTMLInputElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadBodies = useCallback(
    async (noteIds: string[]) => {
      if (!resolvedProjectId || noteIds.length === 0) {
        setBodiesMap(new Map());
        return;
      }
      const svc = useStore.getState().getNoteService();
      const bodies = await svc.getBodies(resolvedProjectId, noteIds);
      setBodiesMap((prev) => {
        const next = new Map(prev);
        for (const [k, v] of bodies) next.set(k, v);
        return next;
      });

      const attResults = await Promise.all(
        noteIds.map(async (id) => {
          try {
            const note = await svc.getNote(resolvedProjectId, id);
            return { id, attachments: note?.frontmatter.attachments || [] };
          } catch {
            return { id, attachments: [] };
          }
        }),
      );
      setAttachmentsMap((prev) => {
        const next = new Map(prev);
        for (const r of attResults) next.set(r.id, r.attachments);
        return next;
      });
    },
    [resolvedProjectId, useStore.getState],
  );

  const notesRef = useRef(notes);
  notesRef.current = notes;

  const loadNotes = useCallback(
    async (reset?: boolean) => {
      try {
        const svc = useStore.getState().getNoteService();
        if (searchQuery) {
          const list = await svc.searchNotes(searchQuery);
          setNotes(list);
          if (resolvedProjectId && list.length > 0) {
            await loadBodies(list.map((n) => n.id));
          } else {
            setBodiesMap(new Map());
          }
          return;
        }
        const offset = reset ? 0 : notesRef.current.length;
        const list = await svc.listNotes({ limit: NOTE_LIST_PAGE_SIZE, offset });
        const reachedEnd = list.length < NOTE_LIST_PAGE_SIZE;
        if (reset) {
          setNotes(list);
        } else {
          setNotes((prev) => [...prev, ...list]);
        }
        setTotalCount(reachedEnd ? offset + list.length : -1);
        if (resolvedProjectId && list.length > 0) {
          await loadBodies(list.map((n) => n.id));
        }
      } catch (e) {
        toast.error(`Failed to load notes: ${(e as Error).message}`);
      }
    },
    [searchQuery, resolvedProjectId, loadBodies, useStore.getState],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: noteVersion intentionally triggers re-fetch
  useEffect(() => {
    if (!resolvedProjectId) return;
    let cancelled = false;
    const init = async () => {
      try {
        await useStore.getState().init();
        await useStore.getState().activateVault(resolvedProjectId);
        const v = useStore.getState().vaults.find((v) => v.projectId === resolvedProjectId);
        if (cancelled) return;
        setVaultName(v?.name ?? '');
        setReady(true);
        setBodiesMap(new Map());
        const svc = useStore.getState().getNoteService();
        const tags = await svc.getAllTags();
        if (cancelled) return;
        setAvailableTags(tags);
        const list = searchQuery
          ? await svc.searchNotes(searchQuery)
          : await svc.listNotes({ limit: NOTE_LIST_PAGE_SIZE, offset: 0 });
        if (cancelled) return;
        setNotes(list);
        const reachedEnd = !searchQuery && list.length < NOTE_LIST_PAGE_SIZE;
        if (!searchQuery) {
          setTotalCount(reachedEnd ? list.length : -1);
        }
        if (resolvedProjectId && list.length > 0) {
          const bodies = await svc.getBodies(
            resolvedProjectId,
            list.map((n) => n.id),
          );
          if (cancelled) return;
          setBodiesMap(bodies);

          const attResults = await Promise.all(
            list.map(async (n) => {
              try {
                const parsed = await svc.getNote(resolvedProjectId, n.id);
                return { id: n.id, attachments: parsed?.frontmatter.attachments || [] };
              } catch {
                return { id: n.id, attachments: [] };
              }
            }),
          );
          if (cancelled) return;
          setAttachmentsMap((prev) => {
            const next = new Map(prev);
            for (const r of attResults) next.set(r.id, r.attachments);
            return next;
          });
        }
      } catch (e) {
        if (!cancelled) toast.error(`Failed to activate vault: ${(e as Error).message}`);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [resolvedProjectId, searchQuery, noteVersion, useStore.getState]);

  useEffect(() => {
    const query = searchParams.get('q') || '';
    setSearchQuery(query);
    setInputQuery(query);
  }, [searchParams]);

  const hasMore = !searchQuery && totalCount === -1;

  useEffect(() => {
    if (!ready || searchQuery || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          setLoadingMore(true);
          loadNotes().finally(() => setLoadingMore(false));
        }
      },
      { threshold: 0.1 },
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [ready, searchQuery, hasMore, loadingMore, loadNotes]);

  const syncTagsToMenu = async (content: string) => {
    if (!resolvedProjectId) return;
    const hashtagRegex = /#([\w\u4e00-\u9fa5]+)/g;
    const matches = content.matchAll(hashtagRegex);
    const tagNames = Array.from(new Set(Array.from(matches).map((m) => m[1])));
    if (tagNames.length === 0) return;

    const currentItems = useStore.getState().menuItems;
    const existingSearches = new Set(
      currentItems.filter((i) => i.type === 'search').map((i) => i.search),
    );

    const store = useStore.getState();
    for (const tag of tagNames) {
      if (!existingSearches.has(`#${tag}`)) {
        await store.addMenuItem(resolvedProjectId, {
          parentId: null,
          title: tag,
          type: 'search',
          search: `#${tag}`,
        });
      }
    }
  };

  const handleComposerSubmit = async () => {
    if (!composerContent.trim() || !resolvedProjectId) return;
    try {
      const svc = getNoteService();
      const noteId = await svc.createNote(resolvedProjectId, composerContent);

      if (composerAttachments.length > 0) {
        await svc.saveNoteWithAttachments(resolvedProjectId, noteId, {
          body: composerContent,
          attachments: composerAttachments,
          removedPaths: [],
        });
      }

      await syncTagsToMenu(composerContent);
      setComposerContent('');
      setComposerAttachments([]);
      composerRef.current?.setMarkdown('');
      composerRef.current?.focus();
      await loadNotes(true);
      const attPaths = composerAttachments.map((a) => a.path);
      useStore.getState().notifyNoteChange(resolvedProjectId, noteId, 'create', attPaths);
    } catch (e) {
      toast.error(`Failed to create note: ${(e as Error).message}`);
    }
  };

  const handleUpdate = async (noteId: string, content: string) => {
    if (!resolvedProjectId) return;
    try {
      const svc = getNoteService();

      if (editAttachments.length > 0 || editRemovedPaths.length > 0) {
        await svc.saveNoteWithAttachments(resolvedProjectId, noteId, {
          body: content,
          attachments: editAttachments,
          removedPaths: editRemovedPaths,
        });
      } else {
        await svc.updateNote(resolvedProjectId, noteId, content);
      }

      await syncTagsToMenu(content);
      setEditingId(null);
      setEditAttachments([]);
      setEditRemovedPaths([]);
      await loadNotes(true);
      const attPaths = editAttachments.map((a) => a.path);
      useStore.getState().notifyNoteChange(resolvedProjectId, noteId, 'update', attPaths);
    } catch (e) {
      toast.error(`Failed to update note: ${(e as Error).message}`);
    }
  };

  const handleDelete = async () => {
    if (!noteToDelete || !resolvedProjectId) return;
    try {
      const svc = getNoteService();
      await svc.deleteNote(resolvedProjectId, noteToDelete);
      setNoteToDelete(null);
      setIsDeleteDialogOpen(false);
      toast.success('Note deleted');
      await loadNotes(true);
      useStore.getState().notifyNoteChange(resolvedProjectId, noteToDelete, 'delete');
    } catch (e) {
      toast.error(`Failed to delete note: ${(e as Error).message}`);
    }
  };

  const handleAddToMenu = async () => {
    if (!menuNoteId || !menuName.trim() || !resolvedProjectId) return;
    try {
      await useStore.getState().addMenuItem(resolvedProjectId, {
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

  const handleSync = async () => {
    if (!resolvedProjectId || isSyncing) return;
    try {
      const result = await useStore.getState().sync(resolvedProjectId);
      await loadNotes(true);
      if (result.pushed > 0 || result.pulled > 0) {
        toast.success(`Synced: ${result.pushed} pushed, ${result.pulled} pulled`);
      } else {
        toast.success('Already up to date');
      }
      if (result.errors.length > 0) {
        toast.error(`Sync errors: ${result.errors.join('; ')}`);
      }
    } catch (e) {
      toast.error(`Sync failed: ${(e as Error).message}`);
    }
  };

  const handleComposerAddFiles = useCallback(
    async (files: File[]) => {
      if (!resolvedProjectId) return;
      const svc = useStore.getState().getNoteService();
      const attSvc = svc.getAttachmentService(resolvedProjectId);
      const newAttachments: PendingAttachment[] = [];

      for (const file of files) {
        const ext = extFromFilename(file.name);
        const data = await file.arrayBuffer();
        const { path } = await attSvc.writeIfNew(data, ext);
        newAttachments.push({
          type: 'pending',
          path,
          data,
          name: file.name,
          mime: file.type || inferMimeFromExt(ext),
          size: file.size,
        });
      }

      setComposerAttachments((prev) => [...prev, ...newAttachments]);
    },
    [resolvedProjectId, useStore.getState],
  );

  const handleComposerRemoveAttachment = useCallback((idx: number) => {
    setComposerAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleEditAddFiles = useCallback(
    async (files: File[]) => {
      if (!resolvedProjectId) return;
      const svc = useStore.getState().getNoteService();
      const attSvc = svc.getAttachmentService(resolvedProjectId);
      const newAttachments: PendingAttachment[] = [];

      for (const file of files) {
        const ext = extFromFilename(file.name);
        const data = await file.arrayBuffer();
        const { path } = await attSvc.writeIfNew(data, ext);
        newAttachments.push({
          type: 'pending',
          path,
          data,
          name: file.name,
          mime: file.type || inferMimeFromExt(ext),
          size: file.size,
        });
      }

      setEditAttachments((prev) => [...prev, ...newAttachments]);
    },
    [resolvedProjectId, useStore.getState],
  );

  const handleEditRemoveAttachment = useCallback((idx: number) => {
    setEditAttachments((prev) => {
      const removed = prev[idx];
      if (removed.type === 'existing') {
        setEditRemovedPaths((rp) => [...rp, removed.path]);
      }
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const getAttachmentUrl = useCallback(
    async (path: string): Promise<string> => {
      if (!resolvedProjectId) throw new Error('No project');
      const svc = useStore.getState().getNoteService();
      const blob = await svc.getAttachmentBlob(resolvedProjectId, path);
      const mime = inferMimeFromPath(path);
      return URL.createObjectURL(new Blob([blob], { type: mime || 'application/octet-stream' }));
    },
    [resolvedProjectId, useStore.getState],
  );

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
        <div
          className="flex items-center gap-1 w-full justify-end"
          style={{ maxWidth: headerMaxWidth }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSync}
            disabled={isSyncing}
            title={
              isSyncing
                ? 'Syncing...'
                : lastSyncTime
                  ? `Last sync: ${new Date(lastSyncTime).toLocaleString()}`
                  : 'Sync'
            }
            className="shrink-0 rounded-full"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
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
                key={resolvedProjectId}
                ref={composerRef}
                initialValue={composerContent}
                onChange={setComposerContent}
                placeholder="What's on your mind?"
                minHeight="100px"
                showToolbar={false}
                className="text-lg bg-transparent border-none shadow-none p-0"
                onSubmit={handleComposerSubmit}
                availableTags={availableTags}
              />
              <div className="flex justify-end items-center mt-3 pt-3 border-t border-muted/20">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => composerFileInputRef.current?.click()}
                  className="text-muted-foreground hover:text-foreground mr-auto"
                >
                  <ImagePlus className="w-4 h-4 mr-1" />
                  <span className="text-xs">Add</span>
                </Button>
                <input
                  ref={composerFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.zip,.txt,.json"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) handleComposerAddFiles(files);
                    e.target.value = '';
                  }}
                />
                <Button
                  onClick={handleComposerSubmit}
                  disabled={!composerContent.trim()}
                  className="rounded-full w-12"
                  size="sm"
                >
                  <SendHorizontal strokeWidth={3} className="w-4 h-4" />
                </Button>
              </div>
              <AttachmentZone
                attachments={composerAttachments}
                editable={true}
                onAdd={handleComposerAddFiles}
                onRemove={handleComposerRemoveAttachment}
                getAttachmentUrl={getAttachmentUrl}
              />
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
              setEditingId={(id) => {
                if (id) {
                  const existing = attachmentsMap.get(id) || [];
                  setEditAttachments(attachmentRefToEditAttachment(existing));
                  setEditRemovedPaths([]);
                } else {
                  setEditAttachments([]);
                  setEditRemovedPaths([]);
                }
                setEditingId(id);
              }}
              editorRef={editorRef}
              initialBody={bodiesMap.get(note.id) ?? null}
              attachments={attachmentsMap.get(note.id) || []}
              editAttachments={editAttachments}
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
              linkExtraProps={linkExtraProps}
              availableTags={availableTags}
              onAddFiles={handleEditAddFiles}
              onRemoveAttachment={handleEditRemoveAttachment}
              getAttachmentUrl={getAttachmentUrl}
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

          <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading more...
              </div>
            )}
          </div>
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
  initialBody,
  attachments,
  editAttachments,
  onUpdate,
  onDelete,
  onAddToMenu,
  linkExtraProps,
  availableTags: noteAvailableTags,
  onAddFiles,
  onRemoveAttachment,
  getAttachmentUrl,
}: {
  note: NoteIndex;
  notebookToken: string;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  editorRef: React.RefObject<MarkdownEditorRef | null>;
  initialBody: string | null;
  attachments: AttachmentRef[];
  editAttachments: EditAttachment[];
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => void;
  onAddToMenu: (id: string) => void;
  linkExtraProps?: Record<string, unknown>;
  availableTags: string[];
  onAddFiles: (files: File[]) => void;
  onRemoveAttachment: (idx: number) => void;
  getAttachmentUrl: (path: string) => Promise<string>;
}) {
  const [body, setBody] = useState<string | null>(initialBody);
  const isEditing = editingId === note.id;
  const displayAttachments = attachmentRefToEditAttachment(attachments);

  useEffect(() => {
    setBody(initialBody);
  }, [initialBody]);

  return (
    <Card className="group overflow-hidden transition-all duration-300 border-muted/60 hover:shadow-md hover:border-muted-foreground/20">
      <div className="px-5 py-3 border-b border-muted/40 flex justify-between items-center bg-muted/20">
        <div className="flex items-center gap-4">
          <Link
            to={`/s/${notebookToken}/${noteIdToUrl(note.id)}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium hover:text-primary transition-colors cursor-pointer"
            {...linkExtraProps}
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
                <span
                  key={tag}
                  className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                >
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
                <Link
                  to={`/s/${notebookToken}/${noteIdToUrl(note.id)}`}
                  className="cursor-pointer"
                  {...linkExtraProps}
                >
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
                availableTags={noteAvailableTags}
              />
            )}
            <AttachmentZone
              attachments={editAttachments}
              editable={true}
              onAdd={onAddFiles}
              onRemove={onRemoveAttachment}
              getAttachmentUrl={getAttachmentUrl}
            />
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
        {!isEditing && displayAttachments.length > 0 && (
          <div className="px-5 pb-4">
            <AttachmentZone
              attachments={displayAttachments}
              editable={false}
              getAttachmentUrl={getAttachmentUrl}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
