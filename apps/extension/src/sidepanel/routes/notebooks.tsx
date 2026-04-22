import { cn, NoteService } from '@timenote/core';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
} from '@timenote/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Edit2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export function NotebooksList() {
  const notebooks = useLiveQuery(() => NoteService.getAllNotebooks());
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await NoteService.createNotebook(newName.trim());
    setNewName('');
    navigate(`/notebook/${id}`);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await NoteService.updateNotebook(id, { name: editName.trim() });
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await NoteService.deleteNotebook(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="flex gap-2">
          <Input
            placeholder="新建笔记本..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {notebooks?.length === 0 && (
          <div className="p-4 text-center text-muted-foreground text-sm">
            还没有笔记本，创建一个开始吧
          </div>
        )}
        {notebooks?.map((nb) => (
          <div
            key={nb.id}
            className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer group border-b border-border/50"
            onClick={() => navigate(`/notebook/${nb.id}`)}
          >
            {editingId === nb.id ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(nb.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={() => handleRename(nb.id)}
                className="h-7 text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="flex-1 text-sm truncate">{nb.name}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(nb.id);
                      setEditName(nb.name);
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(nb.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，笔记本内的所有笔记也会被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
