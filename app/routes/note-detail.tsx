"use client";

import { useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { NoteService } from "../lib/services/note-service";
import { parseNotebookId } from "../lib/utils/token";
import MarkdownEditor, { type MarkdownEditorRef } from "../components/editor/markdown-editor";
import { type Tag } from "../lib/db";

export default function NoteDetailPage() {
  const { notebookToken, noteId } = useParams();
  const navigate = useNavigate();
  const nId = noteId || "";
  const nbId = parseNotebookId(notebookToken || "");

  const note = useLiveQuery(() => NoteService.getNote(nId), [nId]);
  const notebookTags = useLiveQuery(() => NoteService.getTagsByNotebook(nbId), [nbId]);
  const editorRef = useRef<MarkdownEditorRef>(null);

  const handleUpdate = async (content: string) => {
    await NoteService.updateNote(nId, content);
  };

  const handleSyncTags = async (content: string) => {
    await NoteService.syncNoteTagsFromContent(nId, nbId, content);
  };

  if (!note) return null;

  const availableTagNames = (notebookTags || []).map(t => t.name);

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <nav className="flex items-center justify-between mb-8">
          <Link 
            to={`/s/${notebookToken}`} 
            className="text-gray-900 dark:text-white font-bold text-xl hover:opacity-70 transition-opacity"
          >
            ← Timeline
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 font-medium">
              Updated: {new Date(note.updatedAt).toLocaleString()}
            </span>
            <button 
              onClick={() => {
                const content = editorRef.current?.getMarkdown() || "";
                handleSyncTags(content);
                navigate(`/s/${notebookToken}`);
              }}
              className="bg-blue-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-sm"
            >
              Done
            </button>
          </div>
        </nav>

        <div className="mb-6 px-4">
          <NoteTagsView noteId={nId} />
        </div>

        <div className="min-h-[70vh]">
          <MarkdownEditor
            ref={editorRef}
            initialValue={note.content}
            onChange={handleUpdate}
            onBlur={handleSyncTags}
            onSubmit={() => {
              const content = editorRef.current?.getMarkdown() || "";
              handleSyncTags(content);
              navigate(`/s/${notebookToken}`);
            }}
            availableTags={availableTagNames}
            autoFocus
            minHeight="70vh"
            className="text-lg"
          />
        </div>

        <footer className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 flex justify-between text-gray-400 text-sm">
           <div>Note ID: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{nId}</code></div>
           <div>{note.content.length} characters</div>
        </footer>
      </div>
    </main>
  );
}

function NoteTagsView({ noteId }: { noteId: string }) {
  const noteTags = useLiveQuery(() => NoteService.getTagsForNote(noteId), [noteId]);

  if (!noteTags || noteTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {noteTags.map(tag => (
        <span 
          key={tag.id} 
          className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded"
        >
          #{tag.name}
        </span>
      ))}
    </div>
  );
}
