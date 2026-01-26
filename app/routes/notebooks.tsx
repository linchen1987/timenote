import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  Calendar,
  Cloud,
  CloudDownload,
  Download,
  Edit2,
  MoreVertical,
  Notebook as NotebookIcon,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, type MetaFunction } from 'react-router';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Input } from '~/components/ui/input';
import type { BackupData } from '~/lib/services/backup-types';
import { ExportService } from '~/lib/services/export-service';
import { ImportService } from '~/lib/services/import-service';
import { NoteService } from '~/lib/services/note-service';
import { SyncService } from '~/lib/services/sync-service';
import { createNotebookToken } from '~/lib/utils/token';

export const meta: MetaFunction = () => {
  return [{ title: 'Time Note' }];
};

export default function NotebooksPage() {
  const notebooks = useLiveQuery(() => NoteService.getAllNotebooks());
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [notebookToDelete, setNotebookToDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [remoteNotebooks, setRemoteNotebooks] = useState<any[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const loadRemote = useCallback(async () => {
    setIsLoadingRemote(true);
    try {
      const list = await SyncService.getRemoteNotebooks();
      setRemoteNotebooks(list);
    } catch (e) {
      console.error('Failed to load remote notebooks', e);
    } finally {
      setIsLoadingRemote(false);
    }
  }, []);

  useEffect(() => {
    loadRemote();
  }, [loadRemote]);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await SyncService.syncNotebook(id);
      toast.success('Synced successfully');
      loadRemote(); // Refresh remote list to update names or status
    } catch (e) {
      console.error(e);
      toast.error('Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handlePull = async (id: string) => {
    setSyncingId(id);
    try {
      await SyncService.pull(id);
      toast.success('Pulled successfully');
      loadRemote();
    } catch (e) {
      console.error(e);
      toast.error('Pull failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await NoteService.createNotebook(newName);
    setNewName('');
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    setNotebookToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (notebookToDelete) {
      try {
        await NoteService.deleteNotebook(notebookToDelete);
        setNotebookToDelete(null);
        setIsDeleteDialogOpen(false);
        toast.success('Notebook deleted successfully');
      } catch (_error) {
        toast.error('Failed to delete notebook');
      }
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await NoteService.updateNotebook(id, { name: editName });
    setEditingId(null);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;

      toast.promise(ImportService.importData(data), {
        loading: 'Importing data...',
        success: (stats) => {
          const message = `Import complete: ${stats.success} items imported, ${stats.skipped} skipped.`;
          if (stats.errors.length > 0) {
            return `${message} (with some warnings)`;
          }
          return message;
        },
        error: 'Failed to import data.',
      });

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Failed to import data. Please ensure the file is a valid JSON.');
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-4 sm:p-8 flex flex-col">
      <div className="max-w-5xl mx-auto space-y-10 flex-1 w-full">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">My Notebooks</h1>
            <p className="text-muted-foreground font-medium">
              Manage and organize your thoughts across different notebooks.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".json"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="lg"
              className="rounded-full gap-2 px-6"
              onClick={handleImportClick}
            >
              <Upload className="w-4 h-4" /> Import
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full gap-2 px-6"
              onClick={() => ExportService.exportData()}
            >
              <Download className="w-4 h-4" /> Download
            </Button>
            <Button
              onClick={() => setIsCreating(true)}
              size="lg"
              className="rounded-full shadow-lg hover:shadow-xl transition-all gap-2 px-8"
            >
              <Plus className="w-5 h-5" /> Create Notebook
            </Button>
            <Link to="/settings">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </header>

        {isCreating && (
          <Card className="border-primary/20 bg-primary/5 shadow-inner">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
              <Input
                autoFocus
                className="flex-1 bg-background"
                placeholder="Enter notebook name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <div className="flex gap-2">
                <Button onClick={handleCreate}>Create</Button>
                <Button variant="ghost" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks?.map((nb) => (
            <Card
              key={nb.id}
              className="group hover:shadow-xl transition-all duration-300 border-muted/60 flex flex-col"
            >
              <CardHeader className="relative flex-1">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4">
                    <NotebookIcon className="w-6 h-6" />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handlePull(nb.id)}>
                        <CloudDownload className="w-4 h-4 mr-2" /> Pull from Cloud
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingId(nb.id);
                          setEditName(nb.name);
                        }}
                      >
                        <Edit2 className="w-4 h-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(nb.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {editingId === nb.id ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(nb.id)}
                      onBlur={() => setEditingId(null)}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => handleRename(nb.id)}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Link
                      to={`/s/${createNotebookToken(nb.id, nb.name)}`}
                      className="block group/link"
                    >
                      <CardTitle className="text-2xl group-hover/link:text-primary transition-colors">
                        {nb.name}
                      </CardTitle>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-2 font-mono">ID: {nb.id}</p>
                  </>
                )}
              </CardHeader>
              <CardFooter className="bg-muted/30 border-t border-muted/40 py-3 flex justify-between items-center text-xs text-muted-foreground font-medium">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 opacity-70" />
                  {new Date(nb.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleSync(nb.id)}
                    disabled={syncingId === nb.id}
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${syncingId === nb.id ? 'animate-spin' : ''}`}
                    />
                  </Button>
                  <Link
                    to={`/s/${createNotebookToken(nb.id, nb.name)}`}
                    className="text-primary hover:underline flex items-center gap-1 font-bold"
                  >
                    Open <BookOpen className="w-3 h-3" />
                  </Link>
                </div>
              </CardFooter>
            </Card>
          ))}

          {notebooks?.length === 0 && !isCreating && remoteNotebooks.length === 0 && (
            <div className="sm:col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-32 text-center bg-muted/20 rounded-3xl border-2 border-dashed border-muted">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary/40">
                <NotebookIcon className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold">No notebooks found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mb-8">
                Every great journey begins with a single page. Start yours by creating a new
                notebook.
              </p>
              <Button
                onClick={() => setIsCreating(true)}
                size="lg"
                className="rounded-full gap-2 px-8 shadow-md"
              >
                <Plus className="w-5 h-5" /> Create your first notebook
              </Button>
            </div>
          )}
        </div>

        {/* Remote Notebooks Section */}
        {remoteNotebooks.length > 0 && (
          <div className="space-y-6 mt-10">
            <div className="flex items-center gap-2 border-t pt-10">
              <Cloud className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-bold">Remote Notebooks</h2>
              {isLoadingRemote && (
                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {remoteNotebooks
                .filter((rnb) => !notebooks?.some((nb) => nb.id === rnb.id))
                .map((rnb) => (
                  <Card
                    key={rnb.id}
                    className="group hover:shadow-md transition-all border-dashed border-blue-200 bg-blue-50/50 dark:bg-blue-950/10"
                  >
                    <CardHeader>
                      <CardTitle className="text-xl">{rnb.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">ID: {rnb.id}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button
                        className="w-full gap-2"
                        variant="outline"
                        onClick={() => handleSync(rnb.id)}
                        disabled={syncingId === rnb.id}
                      >
                        {syncingId === rnb.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CloudDownload className="w-4 h-4" />
                        )}
                        Download & Sync
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              {/* If all remote notebooks are already local */}
              {remoteNotebooks.filter((rnb) => !notebooks?.some((nb) => nb.id === rnb.id))
                .length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-8 italic">
                  All remote notebooks are already synced locally.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="max-w-5xl mx-auto mt-20 pb-8 text-center">
        <Link
          to="/playground"
          className="text-[10px] text-muted-foreground/40 hover:text-primary/40 transition-colors uppercase tracking-widest font-medium"
        >
          Playground
        </Link>
      </footer>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your notebook and all its
              notes from our local database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
