"use client";

import { useRef } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import MarkdownEditor, { type MarkdownEditorRef } from "../components/editor/markdown-editor";

export default function NoteDetailPage() {
  const { notebookId, noteId } = useParams();
  const navigate = useNavigate();
  const nId = noteId || "";
  const nbId = notebookId || "";

  const note = useLiveQuery(() => db.notes.get(nId), [nId]);
  const editorRef = useRef<MarkdownEditorRef>(null);

  const handleUpdate = async (content: string) => {
    await db.notes.update(nId, {
      content,
      updatedAt: Date.now(),
    });
  };

  if (!note) return null;

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <nav className="flex items-center justify-between mb-8">
          <Link 
            to={`/notebooks/${nbId}`} 
            className="text-gray-900 dark:text-white font-bold text-xl hover:opacity-70 transition-opacity"
          >
            ← Timeline
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 font-medium">
              Updated: {new Date(note.updatedAt).toLocaleString()}
            </span>
            <button 
              onClick={() => navigate(`/notebooks/${nbId}`)}
              className="bg-blue-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-sm"
            >
              Done
            </button>
          </div>
        </nav>

        <div className="min-h-[70vh]">
          <MarkdownEditor
            ref={editorRef}
            initialValue={note.content}
            onChange={handleUpdate}
            onSubmit={() => navigate(`/notebooks/${nbId}`)}
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
