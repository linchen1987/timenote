"use client";

import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { STORAGE_KEYS } from "../lib/constants";
import MarkdownEditor, { type MarkdownEditorRef } from "../components/editor/markdown-editor";

interface Note {
  id: string;
  content: string;
  updatedAt: string;
}

export default function NoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
    if (saved) {
      const notes: Note[] = JSON.parse(saved);
      const found = notes.find((n) => n.id === id);
      if (found) {
        setNote(found);
      } else {
        navigate("/notebook");
      }
    }
  }, [id, navigate]);

  const saveNote = (updatedNote: Note) => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
    if (saved) {
      const notes: Note[] = JSON.parse(saved);
      const newNotes = notes.map((n) => (n.id === updatedNote.id ? updatedNote : n));
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(newNotes));
      setNote(updatedNote);
    }
  };

  const handleContentChange = (content: string) => {
    if (note) {
      const updated = { ...note, content, updatedAt: new Date().toLocaleString() };
      saveNote(updated);
    }
  };

  if (!note) return null;

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <nav className="flex items-center justify-between mb-8">
          <Link 
            to="/notebook" 
            className="text-gray-900 dark:text-white font-bold text-xl hover:opacity-70 transition-opacity"
          >
            ← Back to Timeline
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 font-medium">{note.updatedAt}</span>
            <button 
              onClick={() => navigate("/notebook")}
              className="bg-blue-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-blue-600 transition-all"
            >
              Done
            </button>
          </div>
        </nav>

        <div className="min-h-[70vh]">
          <MarkdownEditor
            ref={editorRef}
            initialValue={note.content}
            onChange={handleContentChange}
            onSubmit={() => navigate("/notebook")}
            autoFocus
            minHeight="60vh"
            className="text-lg"
          />
        </div>

        <footer className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 flex justify-between text-gray-400 text-sm">
           <div>Markdown WYSIWYG Editor</div>
           <div>{note.content.length} characters</div>
        </footer>
      </div>
    </main>
  );
}
