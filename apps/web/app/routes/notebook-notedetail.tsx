'use client';

import { noteIdFromUrl, parseNotebookId } from '@timenote/core';
import MarkdownEditor, {
  type MarkdownEditorRef,
} from '@timenote/ui/components/editor/markdown-editor';
import { PageHeader } from '@timenote/ui/components/page-header';
import { Button } from '@timenote/ui/components/ui/button';
import { ChevronLeft, Cloud, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { useVaultStore } from '~/lib/vault-store';

export default function VaultNoteDetailPage() {
  const { notebookToken, noteId } = useParams();
  const projectId = parseNotebookId(notebookToken || '');
  const nId = noteIdFromUrl(noteId || '');

  const editorRef = useRef<MarkdownEditorRef>(null);
  const [body, setBody] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialContentRef = useRef('');
  const isSyncing = useVaultStore((s) => s.isSyncing);

  useEffect(() => {
    if (!projectId || !nId) return;
    let cancelled = false;
    const load = async () => {
      try {
        await useVaultStore.getState().init();
        await useVaultStore.getState().activateVault(projectId);
        if (cancelled) return;
        const svc = useVaultStore.getState().getNoteService();
        const note = await svc.getNote(projectId, nId);
        if (cancelled) return;
        if (note) {
          setBody(note.body);
          initialContentRef.current = note.body;
        }
      } catch (e) {
        if (!cancelled) toast.error(`Failed to load note: ${(e as Error).message}`);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, nId]);

  const handleUpdate = useCallback((content: string) => {
    setHasUnsavedChanges(content !== initialContentRef.current);
  }, []);

  const handleSave = useCallback(async () => {
    if (!projectId || !nId) return;
    const content = editorRef.current?.getMarkdown() || '';
    if (content === initialContentRef.current) return;

    try {
      const svc = useVaultStore.getState().getNoteService();
      await svc.updateNote(projectId, nId, content);
      initialContentRef.current = content;
      setHasUnsavedChanges(false);
      toast.success('Saved');
    } catch (e) {
      toast.error(`Failed to save: ${(e as Error).message}`);
    }
  }, [projectId, nId]);

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
            <Link to={`/s/${notebookToken}`} title="Back to Timeline">
              <ChevronLeft className="w-5 h-5" />
            </Link>
          </Button>
        }
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (!projectId || isSyncing) return;
              try {
                const result = await useVaultStore.getState().sync(projectId);
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
            }}
            disabled={isSyncing}
            title="Sync to cloud"
            className="rounded-full"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Cloud className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className="rounded-full"
          >
            Save
          </Button>
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
          />
        </div>

        <footer className="mt-8 pt-8 border-t border-muted/20 flex justify-end text-muted-foreground text-sm px-4 pb-12">
          <div>{body.length} characters</div>
        </footer>
      </div>
    </>
  );
}
