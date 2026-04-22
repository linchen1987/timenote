import { cn, filterNotes, NoteService } from '@timenote/core';
import { Button, Input, ScrollArea } from '@timenote/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useSyncStore } from '../../lib/sync-store';

export function NotebookView() {
  const { notebookId } = useParams<{ notebookId: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const syncStore = useSyncStore();

  const notebook = useLiveQuery(() => NoteService.getNotebook(notebookId!), [notebookId]);
  const notes = useLiveQuery(() => NoteService.getNotesByNotebook(notebookId!), [notebookId]);
  const tagMap = useLiveQuery(() => NoteService.getNoteTagNamesMap(), []);

  const filteredNotes = useMemo(
    () => filterNotes(notes || [], search, tagMap),
    [notes, search, tagMap],
  );

  useEffect(() => {
    if (notebookId) {
      syncStore.ensurePulled(notebookId);
    }
  }, [notebookId]);

  const handleCreateNote = async () => {
    if (!notebookId) return;
    const content = composerRef.current?.value?.trim() || '';
    const id = await NoteService.createNoteWithContent(notebookId, content);
    navigate(`/notebook/${notebookId}/notes/${id}`);
    if (composerRef.current) composerRef.current.value = '';
  };

  const handleDeleteNote = async (id: string) => {
    await NoteService.deleteNote(id);
    if (notebookId) {
      syncStore.syncPush(notebookId, { showToast: true, skipPull: true });
    }
  };

  if (!notebook) {
    return <div className="p-4 text-center text-muted-foreground text-sm">笔记本未找到</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium truncate flex-1">{notebook.name}</span>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索笔记..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-sm pl-7"
          />
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <textarea
          ref={composerRef}
          placeholder="快速记录..."
          className="w-full h-16 text-sm bg-muted/50 rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleCreateNote();
            }
          }}
        />
        <div className="flex justify-end mt-1">
          <Button size="sm" className="h-7 text-xs" onClick={handleCreateNote}>
            <Plus className="h-3 w-3 mr-1" />
            添加
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/50">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="px-3 py-2 hover:bg-accent/50 cursor-pointer"
              onClick={() => navigate(`/notebook/${notebookId}/notes/${note.id}`)}
            >
              <p className="text-sm line-clamp-2 whitespace-pre-wrap">
                {note.content || <span className="text-muted-foreground">空白笔记</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(note.updatedAt).toLocaleString()}
              </p>
            </div>
          ))}
          {filteredNotes.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {search ? '没有匹配的笔记' : '还没有笔记'}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
