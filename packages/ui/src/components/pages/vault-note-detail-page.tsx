import {
  type EditAttachment,
  extFromFilename,
  inferMimeFromExt,
  inferMimeFromPath,
  noteIdFromUrl,
  type PendingAttachment,
  parseNotebookId,
  type VaultStore,
} from '@timenote/core';
import { ChevronLeft, ImagePlus, Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { AttachmentZone, attachmentRefToEditAttachment } from '../attachment/attachment-zone';
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
  const [attachments, setAttachments] = useState<EditAttachment[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const { handleSync, syncIcon, syncTitle, isSyncing } = useSyncButton(useStore, projectId);

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
        const note = await svc.getNote(projectId, nId);
        if (cancelled) return;
        if (note) {
          setBody(note.body);
          initialContentRef.current = note.body;
          currentContentRef.current = note.body;
          const editAtts = attachmentRefToEditAttachment(note.frontmatter.attachments || []);
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

  const handleUpdate = useCallback((content: string) => {
    currentContentRef.current = content;
    setHasUnsavedChanges(content !== initialContentRef.current);
  }, []);

  const handleAddFiles = useCallback(
    async (files: File[]) => {
      if (!projectId) return;
      const svc = useStore.getState().getNoteService();
      const attSvc = svc.getAttachmentService(projectId);
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
        await svc.updateNote(projectId, nId, content);
      } else if (attachmentsChanged) {
        await svc.saveNoteWithAttachments(projectId, nId, {
          body: content,
          attachments,
          removedPaths,
        });
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
      toast.error(`Failed to save: ${(e as Error).message}`);
    }
  }, [projectId, nId, attachments, removedPaths, useStore.getState]);

  useEffect(() => {
    return () => {
      const content = currentContentRef.current;
      if (content && content !== initialContentRef.current && projectId && nId) {
        const svc = useStore.getState().getNoteService();
        svc.updateNote(projectId, nId, content).then(() => {
          useStore.getState().notifyNoteChange(projectId, nId, 'update');
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
        />

        <footer className="mt-8 pt-8 border-t border-muted/20 flex justify-end text-muted-foreground text-sm px-4 pb-12">
          <div>{body.length} characters</div>
        </footer>
      </div>
    </>
  );
}
