"use client";

import { useState, useRef, useMemo } from "react";
import { Link, useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { NoteService } from "../lib/services/note-service";
import { filterNotes } from "../lib/utils/search";
import MarkdownEditor, { type MarkdownEditorRef } from "../components/editor/markdown-editor";
import { db, type Tag } from "../lib/db";

export default function NotebookTimeline() {
  const { notebookId } = useParams();
  const nbId = notebookId || "";
  
  const notebook = useLiveQuery(() => NoteService.getNotebook(nbId), [nbId]);
  const notes = useLiveQuery(
    () => NoteService.getNotesByNotebook(nbId),
    [nbId]
  );
  const notebookTags = useLiveQuery(() => NoteService.getTagsByNotebook(nbId), [nbId]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);

  // 获取每条笔记关联的标签 ID 映射
  const noteTagIdsMap = useLiveQuery(async () => {
    const associations = await db.noteTags.toArray();
    const map: Record<string, string[]> = {};
    associations.forEach(a => {
      if (!map[a.noteId]) map[a.noteId] = [];
      map[a.noteId].push(a.tagId);
    });
    return map;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    let result = notes || [];
    
    // 标签过滤
    if (selectedTagId && noteTagIdsMap) {
      result = result.filter(note => noteTagIdsMap[note.id!]?.includes(selectedTagId));
    }

    // 搜索过滤
    return filterNotes(result, searchQuery);
  }, [notes, searchQuery, selectedTagId, noteTagIdsMap]);

  const handleCreate = async () => {
    const id = await NoteService.createNote(nbId);
    setEditingId(id);
  };

  const handleUpdate = async (id: string, content: string) => {
    await NoteService.updateNote(id, content);
  };

  const handleSyncTags = async (id: string, content: string) => {
    await NoteService.syncNoteTagsFromContent(id, nbId, content);
  };

  const handleDelete = async (id: string) => {
    if (confirm("确定要删除这条笔记吗？")) {
      await NoteService.deleteNote(id);
    }
  };

  if (!notebook) return null;

  const availableTagNames = (notebookTags || []).map(t => t.name);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-center mb-6">
          <div>
            <nav className="mb-2">
              <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 font-medium">← All Notebooks</Link>
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

        {/* 标签过滤栏 */}
        {notebookTags && notebookTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTagId(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                !selectedTagId 
                ? 'bg-blue-500 text-white shadow-sm' 
                : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
            {notebookTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => setSelectedTagId(tag.id === selectedTagId ? null : tag.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  tag.id === selectedTagId 
                  ? 'bg-blue-500 text-white shadow-sm' 
                  : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        )}

        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search notes..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 dark:text-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredNotes?.map((note) => (
            <div 
              key={note.id} 
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 group overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-gray-50 dark:border-gray-700/50 flex justify-between items-center bg-gray-50/30 dark:bg-gray-900/20">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-400">
                    {new Date(note.updatedAt).toLocaleString()}
                  </span>
                  {/* 笔记关联的标签展示 (只读) */}
                  <NoteTagsView noteId={note.id!} />
                </div>
                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                  <Link to={`/notebooks/${nbId}/${note.id}`} className="text-gray-300 hover:text-blue-500 text-xs font-medium">Full Screen</Link>
                  <button 
                    onClick={() => handleDelete(note.id!)}
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
                      onChange={(val) => handleUpdate(note.id!, val)}
                      onBlur={(val) => {
                        handleSyncTags(note.id!, val);
                        setEditingId(null);
                      }}
                      onSubmit={() => {
                        const content = editorRef.current?.getMarkdown() || "";
                        handleSyncTags(note.id!, content);
                        setEditingId(null);
                      }}
                      availableTags={availableTagNames}
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
                    onClick={() => setEditingId(note.id!)}
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
          
          {notes?.length !== 0 && filteredNotes?.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              No notes match your search.
            </div>
          )}
          
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

function NoteTagsView({ noteId }: { noteId: string }) {
  const noteTags = useLiveQuery(() => NoteService.getTagsForNote(noteId), [noteId]);

  if (!noteTags || noteTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {noteTags.map(tag => (
        <span 
          key={tag.id} 
          className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded"
        >
          #{tag.name}
        </span>
      ))}
    </div>
  );
}
