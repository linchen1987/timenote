'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import MarkdownEditor, { type MarkdownEditorRef } from '~/components/editor/markdown-editor';
import { Button } from '~/components/ui/button';
import { NoteService } from '~/lib/services/note-service';
import { SyncService } from '~/lib/services/sync/service';
import { WebDAVService } from '~/lib/services/webdav-service';
import { cn } from '~/lib/utils';
import { getNotebookMeta } from '~/lib/utils/pwa';
import { parseNotebookId } from '~/lib/utils/token';
import type { Route } from './+types/note-detail';

export const meta: Route.MetaFunction = ({ params }) => {
  return getNotebookMeta('', params.notebookToken);
};

export default function NoteDetailPage() {
  const { notebookToken, noteId } = useParams();
  const nId = noteId || '';
  const nbId = parseNotebookId(notebookToken || '');

  const note = useLiveQuery(() => NoteService.getNote(nId), [nId]);
  const notebook = useLiveQuery(() => NoteService.getNotebook(nbId), [nbId]);
  const editorRef = useRef<MarkdownEditorRef>(null);
  const initialContentRef = useRef('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (note) {
      initialContentRef.current = note.content;
    }
  }, [note]);

  const handleUpdate = useCallback((content: string) => {
    const hasChanges = content !== initialContentRef.current;
    setHasUnsavedChanges(hasChanges);
  }, []);

  useEffect(() => {
    if (notebook) {
      document.title = `${notebook.name} | Time Note`;
    }
  }, [notebook]);

  const handleSync = useCallback(async () => {
    if (!WebDAVService.isConfigured()) {
      return;
    }

    setIsSyncing(true);
    try {
      await SyncService.push(nbId);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      console.error('Sync error:', e);
      toast.error(`Sync failed: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
    }
  }, [nbId]);

  const handleSaveLocal = useCallback(async () => {
    const content = editorRef.current?.getMarkdown() || '';
    if (content === initialContentRef.current) {
      return;
    }

    setIsSaving(true);
    try {
      await NoteService.updateNoteWithTags(nId, nbId, content);
      initialContentRef.current = content;
      setHasUnsavedChanges(false);

      if (WebDAVService.isConfigured()) {
        await handleSync();
      }
    } catch (e) {
      console.error('Save error:', e);
      toast.error('Failed to save note');
    } finally {
      setIsSaving(false);
    }
  }, [nId, nbId, handleSync]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges) {
          handleSaveLocal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveLocal, hasUnsavedChanges]);

  if (!note) return null;

  return (
    <>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-muted/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-3 flex justify-between items-center">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link to={`/s/${notebookToken}`} title="Back to Timeline">
              <ChevronLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {isSyncing && (
              <span className="text-xs text-muted-foreground font-medium">Syncing...</span>
            )}
            {hasUnsavedChanges && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSaveLocal}
                disabled={isSaving}
                className="rounded-full cursor-pointer"
                title="Save to local (⌘+S)"
              >
                <Save className={cn('w-5 h-5 text-amber-500', isSaving && 'animate-spin')} />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-1 sm:pt-2 pb-4 sm:pb-8">
        <div className="min-h-[70vh]">
          <MarkdownEditor
            ref={editorRef}
            initialValue={note.content}
            onChange={handleUpdate}
            onSubmit={handleSaveLocal}
            autoFocus
            minHeight="70vh"
            className="text-lg bg-transparent border-none shadow-none p-0"
            showToolbar={true}
          />
        </div>

        <footer className="mt-8 pt-8 border-t border-muted/20 flex justify-between text-muted-foreground text-sm px-4 pb-12">
          <div>
            Note ID: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{nId}</code>
          </div>
          <div>{note.content.length} characters</div>
        </footer>
      </div>
    </>
  );
}
