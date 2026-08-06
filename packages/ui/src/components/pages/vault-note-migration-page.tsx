import {
  type AttachmentRef,
  inferMimeFromPath,
  NOTE_LIST_PAGE_SIZE,
  type NoteIndex,
  parseNotebookId,
} from '@timenote/core';
import {
  ArrowRightLeft,
  Calendar as CalendarIcon,
  LoaderCircle,
  Search as SearchIcon,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import type { VaultStore } from '../../stores/vault-store';
import { AttachmentZone, attachmentRefToEditAttachment } from '../attachment/attachment-zone';
import MarkdownEditor from '../editor/markdown-editor';
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
import { DateRangePicker } from '../ui/date-range-picker';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

type UseVaultStoreHook = {
  (): VaultStore;
  getState: () => VaultStore;
  <T>(selector: (state: VaultStore) => T): T;
};

export interface VaultNoteMigrationPageProps {
  useStore: UseVaultStoreHook;
}

export function VaultNoteMigrationPage({ useStore }: VaultNoteMigrationPageProps) {
  const { notebookToken } = useParams();
  const sourceProjectId = parseNotebookId(notebookToken || '');
  const [notes, setNotes] = useState<NoteIndex[]>([]);
  const [bodies, setBodies] = useState(new Map<string, string>());
  const [attachments, setAttachments] = useState(new Map<string, AttachmentRef[]>());
  const [inputQuery, setInputQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputUpdatedAfter, setInputUpdatedAfter] = useState<string | null>(null);
  const [inputUpdatedBefore, setInputUpdatedBefore] = useState<string | null>(null);
  const [updatedAfter, setUpdatedAfter] = useState<number | undefined>();
  const [updatedBefore, setUpdatedBefore] = useState<number | undefined>();
  const [targetProjectId, setTargetProjectId] = useState('');
  const [pendingNote, setPendingNote] = useState<NoteIndex | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(-1);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migratingNoteId, setMigratingNoteId] = useState<string | null>(null);
  const notesRef = useRef<NoteIndex[]>([]);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const vaults = useStore((state) => state.vaults);
  const noteVersion = useStore((state) => state.noteVersion);
  notesRef.current = notes;

  const loadNoteData = useCallback(
    async (list: NoteIndex[], reset: boolean) => {
      if (!sourceProjectId || list.length === 0) {
        if (reset) {
          setBodies(new Map());
          setAttachments(new Map());
        }
        return;
      }
      const service = useStore.getState().getNoteService();
      const nextBodies = await service.getBodies(
        sourceProjectId,
        list.map((note) => note.id),
      );
      const attachmentEntries = await Promise.all(
        list.map(async (note) => {
          const parsed = await service.getNote(sourceProjectId, note.id);
          return [note.id, parsed?.frontmatter.attachments ?? []] as const;
        }),
      );
      setBodies((current) => (reset ? nextBodies : new Map([...current, ...nextBodies])));
      setAttachments((current) =>
        reset ? new Map(attachmentEntries) : new Map([...current, ...attachmentEntries]),
      );
    },
    [sourceProjectId, useStore],
  );

  const loadNotes = useCallback(
    async (reset = false) => {
      const service = useStore.getState().getNoteService();
      if (searchQuery) {
        const list = (await service.searchNotes(searchQuery)).filter(
          (note) =>
            (updatedAfter === undefined || note.updated_at >= updatedAfter) &&
            (updatedBefore === undefined || note.updated_at <= updatedBefore),
        );
        setNotes(list);
        await loadNoteData(list, true);
        return;
      }
      const offset = reset ? 0 : notesRef.current.length;
      const list = await service.listNotes({
        limit: NOTE_LIST_PAGE_SIZE,
        offset,
        updatedAfter,
        updatedBefore,
      });
      setNotes((current) => (reset ? list : [...current, ...list]));
      setTotalCount(list.length < NOTE_LIST_PAGE_SIZE ? offset + list.length : -1);
      await loadNoteData(list, reset);
    },
    [loadNoteData, searchQuery, updatedAfter, updatedBefore, useStore],
  );

  useEffect(() => {
    if (!sourceProjectId) return;
    let cancelled = false;
    const initialize = async () => {
      void noteVersion;
      setIsLoading(true);
      try {
        const store = useStore.getState();
        await store.init();
        const availableVaults = await store.listVaults();
        await store.activateVault(sourceProjectId);
        if (cancelled) return;
        const initialTarget = availableVaults.find((vault) => vault.projectId !== sourceProjectId);
        setTargetProjectId((current) => current || initialTarget?.projectId || '');
        await loadNotes(true);
      } catch (error) {
        if (!cancelled) toast.error(`Failed to load notes: ${(error as Error).message}`);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    initialize();
    return () => {
      cancelled = true;
    };
  }, [sourceProjectId, noteVersion, loadNotes, useStore]);

  const hasMore = !searchQuery && totalCount === -1;
  useEffect(() => {
    if (!hasMore || isLoading || loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setLoadingMore(true);
        loadNotes().finally(() => setLoadingMore(false));
      }
    });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadingMore, loadNotes]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchQuery(inputQuery.trim());
  };

  const applyDateRange = (from: string | null, to: string | null) => {
    setInputUpdatedAfter(from);
    setInputUpdatedBefore(to);
    setUpdatedAfter(from ? startOfDay(parseDateValue(from)) : undefined);
    setUpdatedBefore(to ? endOfDay(parseDateValue(to)) : undefined);
  };

  useEffect(() => {
    if (!isLoading)
      loadNotes(true).catch((error) =>
        toast.error(`Failed to search notes: ${(error as Error).message}`),
      );
  }, [isLoading, loadNotes]);

  const target = vaults.find((vault) => vault.projectId === targetProjectId);
  const source = vaults.find((vault) => vault.projectId === sourceProjectId);
  const targetVaults = vaults.filter((vault) => vault.projectId !== sourceProjectId);

  const getAttachmentUrl = useCallback(
    async (path: string) => {
      const service = useStore.getState().getNoteService();
      const blob = await service.getAttachmentBlob(sourceProjectId, path);
      return URL.createObjectURL(new Blob([blob], { type: inferMimeFromPath(path) }));
    },
    [sourceProjectId, useStore],
  );

  const confirmMigration = async () => {
    if (!pendingNote || !targetProjectId || !sourceProjectId) return;
    setIsMigrating(true);
    setMigratingNoteId(pendingNote.id);
    setPendingNote(null);
    try {
      const result = await useStore
        .getState()
        .migrateNote({ sourceProjectId, targetProjectId, noteId: pendingNote.id });
      if (result.status === 'completed') {
        toast.success(
          result.targetNoteId === pendingNote.id
            ? `Moved to ${target?.name}`
            : `Moved to ${target?.name} with ID ${result.targetNoteId}`,
        );
      } else {
        toast.error(`Target note was created, but source was retained: ${result.error}`);
      }
      await loadNotes(true);
    } catch (error) {
      toast.error(`Failed to migrate note: ${(error as Error).message}`);
    } finally {
      setIsMigrating(false);
      setMigratingNoteId(null);
    }
  };

  return (
    <>
      <PageHeader title="Move notes">
        <form onSubmit={handleSearch} className="relative group w-full max-w-[360px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 bg-muted/50 border-none rounded-full text-sm"
            value={inputQuery}
            onChange={(event) => setInputQuery(event.target.value)}
            placeholder="Search..."
          />
          {inputQuery && (
            <button
              type="button"
              onClick={() => {
                setInputQuery('');
                setSearchQuery('');
                setInputUpdatedAfter(null);
                setInputUpdatedBefore(null);
                setUpdatedAfter(undefined);
                setUpdatedBefore(undefined);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </form>
      </PageHeader>
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Source notebook</Label>
              <div className="h-10 rounded-md border bg-background px-3 flex items-center text-sm">
                {source?.name ?? 'Loading…'}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="migration-target">Target notebook</Label>
              <select
                id="migration-target"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={targetProjectId}
                onChange={(event) => setTargetProjectId(event.target.value)}
                disabled={targetVaults.length === 0 || isMigrating}
              >
                {targetVaults.length === 0 ? (
                  <option value="">Create another notebook first</option>
                ) : (
                  targetVaults.map((vault) => (
                    <option key={vault.projectId} value={vault.projectId}>
                      {vault.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
          <div className="border-t bg-muted/20 px-5 py-3">
            <MigrationDateFilters
              from={inputUpdatedAfter}
              to={inputUpdatedBefore}
              onApply={applyDateRange}
            />
          </div>
        </div>
        {isMigrating && (
          <output className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="w-4 h-4 animate-spin" /> Moving note…
          </output>
        )}
        <div className="space-y-4 pb-20">
          {notes.map((note) => (
            <MigrationNoteCard
              key={note.id}
              note={note}
              body={bodies.get(note.id) ?? null}
              attachments={attachments.get(note.id) ?? []}
              getAttachmentUrl={getAttachmentUrl}
              onMove={() => setPendingNote(note)}
              disabled={!targetProjectId || isMigrating}
              isMoving={migratingNoteId === note.id}
            />
          ))}
          {!isLoading && notes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <SearchIcon className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold">No notes found</h3>
            </div>
          )}
          <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                Loading more...
              </div>
            )}
          </div>
        </div>
      </main>
      <AlertDialog
        open={pendingNote !== null}
        onOpenChange={(open) => !open && setPendingNote(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move this note?</AlertDialogTitle>
            <AlertDialogDescription>
              The note will move from {source?.name ?? 'the source notebook'} to{' '}
              {target?.name ?? 'the target notebook'}. It will be removed from the source after the
              target copy is created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMigrating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMigration} disabled={isMigrating}>
              {isMigrating ? <LoaderCircle className="w-4 h-4 animate-spin" /> : null}
              {isMigrating ? 'Moving…' : 'Move note'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

function MigrationDateFilters({
  from,
  to,
  onApply,
}: {
  from: string | null;
  to: string | null;
  onApply: (from: string | null, to: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-muted-foreground">Updated</span>
      <DateRangePicker from={from} to={to} onChange={onApply} />
    </div>
  );
}

function parseDateValue(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function MigrationNoteCard({
  note,
  body,
  attachments,
  getAttachmentUrl,
  onMove,
  disabled,
  isMoving,
}: {
  note: NoteIndex;
  body: string | null;
  attachments: AttachmentRef[];
  getAttachmentUrl: (path: string) => Promise<string>;
  onMove: () => void;
  disabled: boolean;
  isMoving: boolean;
}) {
  return (
    <Card className="group overflow-hidden transition-all duration-300 border-muted/60 hover:shadow-md hover:border-muted-foreground/20">
      <div className="px-5 py-3 border-b border-muted/40 flex justify-between items-center bg-muted/20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <CalendarIcon className="w-3.5 h-3.5 opacity-70" />
            {new Date(note.updated_at).toLocaleString([], {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </div>
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
        <Button size="sm" onClick={onMove} disabled={disabled}>
          {isMoving ? (
            <LoaderCircle className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRightLeft className="w-4 h-4" />
          )}{' '}
          Move
        </Button>
      </div>
      <CardContent className="p-0">
        <div className="p-6 min-h-[100px] w-full text-left">
          {body !== null ? (
            <MarkdownEditor initialValue={body} editable={false} className="text-base" />
          ) : (
            <div className="text-muted-foreground text-sm">Loading...</div>
          )}
        </div>
        {attachments.length > 0 && (
          <div className="px-5 pb-4">
            <AttachmentZone
              attachments={attachmentRefToEditAttachment(attachments)}
              editable={false}
              getAttachmentUrl={getAttachmentUrl}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
