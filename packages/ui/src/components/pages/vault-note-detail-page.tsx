import {
  AutomationOperationError,
  draftRegistry,
  type EditAttachment,
  extFromFilename,
  inferMimeFromExt,
  inferMimeFromPath,
  noteIdFromUrl,
  type PendingAttachment,
  parseNotebookId,
} from '@timenote/core';
import { ChevronLeft, ImagePlus, Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import type { VaultStore } from '../../stores/vault-store';
import {
  AttachmentAddButton,
  AttachmentZone,
  attachmentRefToEditAttachment,
} from '../attachment/attachment-zone';
import MarkdownEditor, { type MarkdownEditorRef } from '../editor/markdown-editor';
import { PageHeader } from '../page-header';
import { Button } from '../ui/button';
import { useSyncButton } from './use-sync-button';

type UseVaultStoreHook = {
  (): VaultStore;
  getState: () => VaultStore;
  <T>(selector: (s: VaultStore) => T): T;
};

export interface VaultNoteDetailPageProps {
  useStore: UseVaultStoreHook;
}

export function VaultNoteDetailPage({ useStore }: VaultNoteDetailPageProps) {
  const { notebookToken, noteId } = useParams();
  const navigate = useNavigate();
  const projectId = parseNotebookId(notebookToken || '');
  const nId = noteIdFromUrl(noteId || '');

  const editorRef = useRef<MarkdownEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialContentRef = useRef('');
  const initialAttachmentsRef = useRef<EditAttachment[]>([]);
  const currentContentRef = useRef('');
  // Revision of the note content this editing session started from. Saves are
  // CAS-guarded against it so an agent edit can never be silently overwritten.
  const baseRevisionRef = useRef<string | null>(null);
  const [attachments, setAttachments] = useState<EditAttachment[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const noteVersion = useStore((s) => s.noteVersion);
  const { hasRemote, handleSync, syncIcon, syncTitle, isSyncing } = useSyncButton(
    useStore,
    projectId,
  );

  useEffect(() => {
    if (!projectId || !nId) return;
    let cancelled = false;
    const load = async () => {
      try {
        await useStore.getState().init();
        await useStore.getState().activateVault(projectId);
        if (cancelled) return;
        const svc = useStore.getState().getNoteService();
        const tags = await svc.getAllTags();
        if (cancelled) return;
        setAvailableTags(tags);
        const snapshot = await svc.getNoteSnapshot(projectId, nId);
        if (cancelled) return;
        if (snapshot) {
          baseRevisionRef.current = snapshot.revision;
          setBody(snapshot.body);
          initialContentRef.current = snapshot.body;
          currentContentRef.current = snapshot.body;
          const editAtts = attachmentRefToEditAttachment(snapshot.attachments);
          setAttachments(editAtts);
          initialAttachmentsRef.current = editAtts;
          setRemovedPaths([]);
        }
      } catch (e) {
        if (!cancelled) toast.error(`Failed to load note: ${(e as Error).message}`);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, nId, useStore.getState]);

  // Register this editing session so agent writes on the same note are
  // rejected while a draft exists (NOTE_HAS_UNSAVED_CHANGES).
  useEffect(() => {
    if (!projectId || !nId) return;
    draftRegistry.register(projectId, nId);
    return () => {
      draftRegistry.unregister(projectId, nId);
    };
  }, [projectId, nId]);

  useEffect(() => {
    if (!projectId || !nId) return;
    draftRegistry.setDirty(projectId, nId, hasUnsavedChanges);
  }, [projectId, nId, hasUnsavedChanges]);

  // External note changes (e.g. agent edits) refresh the page only when the
  // editor has no local draft; dirty sessions keep their content untouched.
  const externalVersionRef = useRef(noteVersion);
  useEffect(() => {
    if (externalVersionRef.current === noteVersion) return;
    externalVersionRef.current = noteVersion;
    if (!projectId || !nId) return;
    if (hasUnsavedChanges) return;
    let cancelled = false;
    (async () => {
      try {
        const svc = useStore.getState().getNoteService();
        const snapshot = await svc.getNoteSnapshot(projectId, nId);
        if (cancelled || !snapshot) return;
        if (snapshot.body === currentContentRef.current) return;
        baseRevisionRef.current = snapshot.revision;
        initialContentRef.current = snapshot.body;
        currentContentRef.current = snapshot.body;
        setBody(snapshot.body);
        setAttachments(attachmentRefToEditAttachment(snapshot.attachments));
      } catch {
        // keep last known content on refresh failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteVersion, projectId, nId, hasUnsavedChanges, useStore.getState]);

  const handleUpdate = useCallback((content: string) => {
    currentContentRef.current = content;
    setHasUnsavedChanges(content !== initialContentRef.current);
  }, []);

  const handleAddFiles = useCallback(
    async (files: File[]) => {
      if (!projectId) return;
      const svc = useStore.getState().getNoteService();
      const attSvc = await svc.getAttachmentService(projectId);
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

      setAttachments((prev) => [...prev, ...newAttachments]);
      setHasUnsavedChanges(true);
    },
    [projectId, useStore.getState],
  );

  const handleRemoveAttachment = useCallback((idx: number) => {
    setAttachments((prev) => {
      const removed = prev[idx];
      if (removed.type === 'existing') {
        setRemovedPaths((rp) => [...rp, removed.path]);
      }
      return prev.filter((_, i) => i !== idx);
    });
    setHasUnsavedChanges(true);
  }, []);

  const getAttachmentUrl = useCallback(
    async (path: string): Promise<string> => {
      if (!projectId) throw new Error('No project');
      const svc = useStore.getState().getNoteService();
      const blob = await svc.getAttachmentBlob(projectId, path);
      const mime = inferMimeFromPath(path);
      return URL.createObjectURL(new Blob([blob], { type: mime || 'application/octet-stream' }));
    },
    [projectId, useStore.getState],
  );

  const handleSave = useCallback(async () => {
    if (!projectId || !nId) return;
    const content = editorRef.current?.getMarkdown() || currentContentRef.current;

    try {
      const svc = useStore.getState().getNoteService();
      const contentChanged = content !== initialContentRef.current;
      const attachmentsChanged =
        attachments !== initialAttachmentsRef.current || removedPaths.length > 0;

      if (contentChanged && !attachmentsChanged) {
        let expected = baseRevisionRef.current;
        if (!expected) {
          const snapshot = await svc.getNoteSnapshot(projectId, nId);
          if (!snapshot) throw new Error(`Note not found: ${nId}`);
          expected = snapshot.revision;
        }
        const result = await svc.updateNoteGuarded(projectId, nId, { content }, expected);
        baseRevisionRef.current = result.revision;
      } else if (attachmentsChanged) {
        await svc.saveNoteWithAttachments(projectId, nId, {
          body: content,
          attachments,
          removedPaths,
          expectedRevision: baseRevisionRef.current ?? undefined,
        });
        const snapshot = await svc.getNoteSnapshot(projectId, nId);
        if (snapshot) baseRevisionRef.current = snapshot.revision;
      } else {
        return;
      }

      initialContentRef.current = content;
      initialAttachmentsRef.current = attachments;
      setRemovedPaths([]);
      setHasUnsavedChanges(false);
      const attPaths = attachments.map((a) => a.path);
      useStore.getState().notifyNoteChange(projectId, nId, 'update', attPaths);
    } catch (e) {
      if (e instanceof AutomationOperationError && e.code === 'REVISION_CONFLICT') {
        toast.error('Note was modified elsewhere. Reload before saving.');
        return;
      }
      toast.error(`Failed to save: ${(e as Error).message}`);
    }
  }, [projectId, nId, attachments, removedPaths, useStore.getState]);

  useEffect(() => {
    return () => {
      const content = currentContentRef.current;
      if (content && content !== initialContentRef.current && projectId && nId) {
        const expected = baseRevisionRef.current;
        const svc = useStore.getState().getNoteService();
        // Unmount auto-save must not overwrite a newer persisted version
        // (e.g. an agent edit that landed after this page loaded).
        if (!expected) return;
        draftRegistry.setDirty(projectId, nId, false);
        svc
          .updateNoteGuarded(projectId, nId, { content }, expected)
          .then(() => {
            useStore.getState().notifyNoteChange(projectId, nId, 'update');
          })
          .catch(() => {
            // revision conflict or failure: drop the stale draft rather than
            // clobbering the newer content
          });
      }
    };
  }, [projectId, nId, useStore.getState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, hasUnsavedChanges]);

  if (body === null) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        leftActions={
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <button type="button" onClick={() => navigate(-1)} title="Back to Timeline">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Button>
        }
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full sm:hidden"
            title="Add attachment"
          >
            <ImagePlus className="w-4 h-4 text-muted-foreground" />
          </Button>
          {hasRemote && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSync}
              disabled={isSyncing}
              title={syncTitle}
              className="rounded-full"
            >
              {syncIcon}
            </Button>
          )}
          {hasUnsavedChanges && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              className="rounded-full text-primary"
              title="Save"
            >
              <Save className="w-4 h-4" />
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-1 sm:pt-2 pb-4 sm:pb-8">
        <div className="min-h-[70vh]">
          <MarkdownEditor
            ref={editorRef}
            initialValue={body}
            onChange={handleUpdate}
            onSubmit={handleSave}
            minHeight="70vh"
            className="text-lg bg-transparent border-none shadow-none p-0"
            showToolbar={true}
            availableTags={availableTags}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) handleAddFiles(files);
              e.target.value = '';
            }}
          />
        </div>

        <AttachmentZone
          attachments={attachments}
          editable={true}
          getAttachmentUrl={getAttachmentUrl}
          onAdd={handleAddFiles}
          onRemove={handleRemoveAttachment}
          hideAddButton
        />

        <footer className="mt-6 pt-3 border-t border-muted/20 flex items-center justify-between text-muted-foreground text-sm pb-12">
          <AttachmentAddButton onAdd={handleAddFiles} />
          <div>{body.length} characters</div>
        </footer>
      </div>
    </>
  );
}
