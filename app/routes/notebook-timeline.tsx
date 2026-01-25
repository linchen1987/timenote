"use client";

import { useState, useRef } from "react";
import { Link, useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { NoteService } from "../lib/services/note-service";
import MarkdownEditor, { type MarkdownEditorRef } from "../components/editor/markdown-editor";

export default function NotebookTimeline() {
  const { notebookId } = useParams();
  const nbId = notebookId || "";
  
  const notebook = useLiveQuery(() => NoteService.getNotebook(nbId), [nbId]);
  const notes = useLiveQuery(
    () => NoteService.getNotesByNotebook(nbId),
    [nbId]
  );
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);

  const handleCreate = async () => {
    const id = await NoteService.createNote(nbId);
    setEditingId(id);
  };

  const handleUpdate = async (id: string, content: string) => {
    await NoteService.updateNote(id, content);
  };

  const handleDelete = async (id: string) => {
    if (confirm("确定要删除这条笔记吗？")) {
      await NoteService.deleteNote(id);
    }
  };

  if (!notebook) return null;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <nav className="mb-2">
              <Link to="/notebooks" className="text-sm text-blue-600 dark:text-blue-400 font-medium">← All Notebooks</Link>
            </nav>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {notebook.name}
            </h1>
            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">Notebook ID: {nbId}</p>
          </div>
          <button 
            onClick={handleCreate}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full font-bold transition-all shadow-sm"
          >
            New Note
          </button>
        </header>

        <div className="space-y-4">
          {notes?.map((note) => (
            <div 
              key={note.id} 
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 group overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-gray-50 dark:border-gray-700/50 flex justify-between items-center bg-gray-50/30 dark:bg-gray-900/20">
                <span className="text-xs font-medium text-gray-400">
                  {new Date(note.updatedAt).toLocaleString()}
                </span>
                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                  <Link to={`/notebooks/${nbId}/${note.id}`} className="text-gray-300 hover:text-blue-500 text-xs font-medium">Full Screen</Link>
                  <button 
                    onClick={() => handleDelete(note.id)}
                    className="text-gray-300 hover:text-red-500 text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="p-1">
                {editingId === note.id ? (
                  <div className="p-2">
                    <MarkdownEditor
                      ref={editorRef}
                      initialValue={note.content}
                      onChange={(val) => handleUpdate(note.id, val)}
                      onSubmit={() => setEditingId(null)}
                      autoFocus
                      minHeight="150px"
                    />
                    <div className="mt-2 flex justify-between items-center px-2">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                        Cmd + Enter to save
                      </span>
                      <button 
                        onClick={() => setEditingId(null)}
                        className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => setEditingId(note.id)}
                    className="cursor-text p-5"
                  >
                    <MarkdownEditor
                      initialValue={note.content}
                      editable={false}
                    />
                    {!note.content && <span className="text-gray-300 italic text-sm">Empty note, click to write...</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {notes?.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              This notebook is empty.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
