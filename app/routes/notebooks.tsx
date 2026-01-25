"use client";

import { useState } from "react";
import { Link } from "react-router";
import { db } from "../lib/db";
import { NoteService } from "../lib/services/note-service";
import { useLiveQuery } from "dexie-react-hooks";

export default function NotebooksPage() {
  const notebooks = useLiveQuery(() => NoteService.getAllNotebooks());
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await NoteService.createNotebook(newName);
    setNewName("");
    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("确定要删除这个笔记本及其所有笔记吗？")) {
      await NoteService.deleteNotebook(id);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await NoteService.updateNotebook(id, { name: editName });
    setEditingId(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <nav className="mb-2">
              <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 font-medium">← Back Home</Link>
            </nav>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">My Notebooks</h1>
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm"
          >
            Create Notebook
          </button>
        </header>

        {isCreating && (
          <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl border border-blue-100 dark:border-blue-900 shadow-sm flex gap-3">
            <input 
              autoFocus
              className="flex-1 bg-gray-50 dark:bg-gray-900 border-none outline-none px-4 py-2 rounded-lg text-gray-900 dark:text-white"
              placeholder="Enter notebook name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">Add</button>
            <button onClick={() => setIsCreating(false)} className="text-gray-500 font-medium px-4 py-2">Cancel</button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {notebooks?.map((nb) => (
            <div 
              key={nb.id} 
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all group relative"
            >
              {editingId === nb.id ? (
                <div className="flex gap-2">
                  <input 
                    autoFocus
                    className="flex-1 bg-gray-50 dark:bg-gray-900 border-none outline-none px-3 py-1 rounded-md text-gray-900 dark:text-white"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRename(nb.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(nb.id)}
                  />
                </div>
              ) : (
                <>
                  <Link to={`/notebooks/${nb.id}`} className="block">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 transition-colors">
                      {nb.name}
                    </h2>
                    <p className="text-xs text-gray-400">
                      ID: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{nb.id}</code>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Created {new Date(nb.createdAt).toLocaleDateString()}
                    </p>
                  </Link>
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => { setEditingId(nb.id); setEditName(nb.name); }}
                      className="text-gray-400 hover:text-blue-500 p-1"
                    >
                      ✎
                    </button>
                    <button 
                      onClick={() => handleDelete(nb.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      ✕
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          
          {notebooks?.length === 0 && !isCreating && (
            <div className="sm:col-span-2 text-center py-20 text-gray-400">
              No notebooks found. Start by creating one!
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
