import { NoteService } from '@timenote/core';
import { Button, MarkdownEditor } from '@timenote/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useSyncStore } from '../../lib/sync-store';

export function NoteDetail() {
  const { notebookId, noteId } = useParams<{ notebookId: string; noteId: string }>();
  const navigate = useNavigate();
  const syncStore = useSyncStore();

  const note = useLiveQuery(() => NoteService.getNote(noteId!), [noteId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [note]);

  const handleSave = async (content?: string) => {
    if (!noteId || !notebookId || !note) return;
    const newContent = content ?? note.content;
    await NoteService.updateNoteWithTags(noteId, notebookId, newContent);
    syncStore.syncPush(notebookId, { showToast: false, skipPull: true });
  };

  if (!note) {
    return <div className="p-4 text-center text-muted-foreground text-sm">笔记未找到</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {new Date(note.updatedAt).toLocaleString()}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <MarkdownEditor content={note.content} onChange={(content) => handleSave(content)} />
      </div>
    </div>
  );
}
