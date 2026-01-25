"use client";

import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { STORAGE_KEYS } from "../lib/constants";
import MarkdownEditor, { type MarkdownEditorRef } from "../components/editor/markdown-editor";

interface Note {
  id: string;
  content: string;
  updatedAt: string;
}

export default function NotebookList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);

  // Load notes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
    if (saved) {
      setNotes(JSON.parse(saved));
    } else {
      const initialNotes = [
        { id: "1", content: "# 欢迎使用你的新 Notebook！\n\n这里不需要标题。直接点击这段文字就可以开始编辑，试试看！✨\n\n- [x] 支持 Markdown 渲染\n- [ ] 支持快捷键提交", updatedAt: new Date().toLocaleString() },
      ];
      setNotes(initialNotes);
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(initialNotes));
    }
  }, []);

  const saveToStorage = (updatedNotes: Note[]) => {
    setNotes(updatedNotes);
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updatedNotes));
  };

  const createNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      content: "",
      updatedAt: new Date().toLocaleString(),
    };
    const updated = [newNote, ...notes];
    saveToStorage(updated);
    setEditingId(newNote.id); 
  };

  const updateContent = (id: string, newContent: string) => {
    const updated = notes.map((n) => 
      n.id === id ? { ...n, content: newContent, updatedAt: new Date().toLocaleString() } : n
    );
    saveToStorage(updated);
  };

  const deleteNote = (id: string) => {
    if (confirm("确定要删除这条记录吗？")) {
      saveToStorage(notes.filter((n) => n.id !== id));
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <nav className="mb-2">
              <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 font-medium">← Back Home</Link>
            </nav>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Timeline</h1>
          </div>
          <button 
            onClick={createNote}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full font-bold transition-all shadow-sm hover:shadow-md"
          >
            Post Note
          </button>
        </header>

        <div className="space-y-4">
          {notes.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
              <p className="text-gray-500">记录一些想法吧...</p>
            </div>
          ) : (
            notes.map((note) => (
              <div 
                key={note.id} 
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all group overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-gray-50 dark:border-gray-700/50 flex justify-between items-center bg-gray-50/30 dark:bg-gray-900/20">
                  <span className="text-xs font-medium text-gray-400">{note.updatedAt}</span>
                  <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                    <Link to={`/notebook/${note.id}`} className="text-gray-300 hover:text-blue-500 text-xs font-medium">Full Screen</Link>
                    <button 
                      onClick={() => deleteNote(note.id)}
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
                        onChange={(val) => updateContent(note.id, val)}
                        onSubmit={() => setEditingId(null)}
                        autoFocus
                        minHeight="150px"
                      />
                      <div className="mt-2 flex justify-between items-center px-2">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                          Hint: Cmd + Enter to save
                        </span>
                        <button 
                          onClick={() => setEditingId(null)}
                          className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          Save & Close
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
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
