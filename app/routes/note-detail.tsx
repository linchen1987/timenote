'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { Calendar } from 'lucide-react';
import { useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import MarkdownEditor, { type MarkdownEditorRef } from '~/components/editor/markdown-editor';
import { NoteTagsView } from '~/components/note-tags-view';
import { Button } from '~/components/ui/button';
import { NoteService } from '~/lib/services/note-service';
import { getNotebookMeta } from '~/lib/utils/pwa';
import { parseNotebookId } from '~/lib/utils/token';
import type { Route } from './+types/note-detail';

export const meta: Route.MetaFunction = ({ params }) => {
  return getNotebookMeta('Note Detail', params.notebookToken);
};

export default function NoteDetailPage() {
  const { notebookToken, noteId } = useParams();
  const navigate = useNavigate();
  const nId = noteId || '';
  const nbId = parseNotebookId(notebookToken || '');

  const note = useLiveQuery(() => NoteService.getNote(nId), [nId]);
  const notebookTags = useLiveQuery(() => NoteService.getTagsByNotebook(nbId), [nbId]);
  const editorRef = useRef<MarkdownEditorRef>(null);

  const handleUpdate = async (content: string) => {
    await NoteService.updateNote(nId, content);
  };

  const handleSyncTags = async (content: string) => {
    await NoteService.updateNoteWithTags(nId, nbId, content);
  };

  if (!note) return null;

  const availableTagNames = (notebookTags || []).map((t) => t.name);

  return (
    <>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-muted/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-3 flex justify-between items-center">
          <Link
            to={`/s/${notebookToken}`}
            className="text-lg font-bold hover:text-primary transition-colors flex items-center gap-2"
          >
            ← Timeline
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Calendar className="w-3.5 h-3.5 opacity-70" />
              {new Date(note.updatedAt).toLocaleString([], {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
            <Button
              onClick={() => {
                const content = editorRef.current?.getMarkdown() || '';
                handleSyncTags(content);
                navigate(`/s/${notebookToken}`);
              }}
              size="sm"
              className="rounded-full px-6 font-bold"
            >
              Done
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">
        <div className="px-4">
          <NoteTagsView noteId={nId} />
        </div>

        <div className="min-h-[70vh]">
          <MarkdownEditor
            ref={editorRef}
            initialValue={note.content}
            onChange={handleUpdate}
            onBlur={handleSyncTags}
            onSubmit={() => {
              const content = editorRef.current?.getMarkdown() || '';
              handleSyncTags(content);
              navigate(`/s/${notebookToken}`);
            }}
            availableTags={availableTagNames}
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
