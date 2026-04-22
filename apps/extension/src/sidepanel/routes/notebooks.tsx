import {
  type BackupData,
  createNotebookToken,
  ExportService,
  ImportService,
  NoteService,
  STORAGE_KEYS,
} from '@timenote/core';
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
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  useTheme,
} from '@timenote/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Calendar,
  Cloud,
  CloudDownload,
  Download,
  Edit2,
  Github,
  Globe,
  LayoutGrid,
  Moon,
  MoreVertical,
  Notebook as NotebookIcon,
  Plus,
  RefreshCw,
  Settings,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { SyncService } from '../../lib/sync-service';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full w-8 h-8 text-muted-foreground hover:text-foreground"
        >
          <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">切换主题</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[120px] backdrop-blur-xl">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="rounded-xl gap-2 cursor-pointer font-medium"
        >
          <Sun className="w-4 h-4 text-orange-500" /> <span>浅色模式</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="rounded-xl gap-2 cursor-pointer font-medium"
        >
          <Moon className="w-4 h-4 text-blue-500" /> <span>深色模式</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NotebooksList() {
  const notebooks = useLiveQuery(() => NoteService.getAllNotebooks());
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [notebookToDelete, setNotebookToDelete] = useState<string | null>(null);

  useEffect(() => {
    localStorage.removeItem(STORAGE_KEYS.LAST_NOTEBOOK_TOKEN);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  interface RemoteNotebook {
    id: string;
    name: string;
    path: string;
  }

  const [remoteNotebooks, setRemoteNotebooks] = useState<RemoteNotebook[]>([]);
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
      toast.success('同步成功');
      loadRemote();
    } catch (e) {
      console.error(e);
      toast.error('同步失败');
    } finally {
      setSyncingId(null);
    }
  };

  const handleRestore = async (id: string) => {
    setSyncingId(id);
    try {
      await SyncService.restoreNotebook(id);
      toast.success('恢复成功');
      loadRemote();
    } catch (e) {
      console.error(e);
      toast.error('恢复失败');
    } finally {
      setSyncingId(null);
    }
  };

  const handlePull = async (id: string) => {
    setSyncingId(id);
    try {
      await SyncService.pull(id);
      toast.success('拉取成功');
      loadRemote();
    } catch (e) {
      console.error(e);
      toast.error('拉取失败');
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await NoteService.createNotebook(newName);
    setNewName('');
    setIsCreating(false);
    toast.success('笔记本创建成功');
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
        toast.success('笔记本已删除');
      } catch (_error) {
        toast.error('删除失败');
      }
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await NoteService.updateNotebook(id, { name: editName });
    setEditingId(null);
    toast.success('重命名成功');
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
        loading: '正在导入数据...',
        success: (stats) => {
          const message = `导入完成：成功 ${stats.success} 条，跳过 ${stats.skipped} 条。`;
          if (stats.errors.length > 0) {
            return `${message} (包含一些警告)`;
          }
          return message;
        },
        error: '导入失败',
      });

      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('导入失败，请确保文件是有效的 JSON 格式。');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 relative overflow-x-hidden font-sans flex flex-col">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-primary/10 rounded-full blur-[120px] opacity-60 animate-pulse" />
        <div
          className="absolute bottom-[5%] right-[-5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] opacity-40 animate-pulse"
          style={{ animationDelay: '3s' }}
        />
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
      </div>

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-2xl">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 group transition-transform hover:scale-105 active:scale-95"
          >
            <span className="text-lg font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/80 to-foreground/60 uppercase">
              Time Note
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="rounded-full w-8 h-8 text-muted-foreground hover:text-foreground"
            >
              <a
                href="https://github.com/linchen1987/timenote"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub 仓库"
              >
                <Github className="w-4 h-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="rounded-full w-8 h-8 text-muted-foreground hover:text-foreground"
            >
              <a
                href="https://link1987.site"
                target="_blank"
                rel="noopener noreferrer"
                title="作者主页"
              >
                <Globe className="w-4 h-4" />
              </a>
            </Button>
            <ThemeToggle />
            <Link to="/settings">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-8 h-8 text-muted-foreground hover:text-foreground"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-24 pb-12 px-4 flex-1">
        <div className="space-y-8">
          <div className="flex flex-col gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black tracking-widest uppercase">
                <LayoutGrid className="w-3 h-3" />
                <span>My Workspace</span>
              </div>
              <h1 className="text-3xl font-black tracking-tighter leading-none uppercase">
                笔记本
              </h1>
              <p className="text-sm text-muted-foreground font-semibold max-w-2xl opacity-80">
                管理和组织你的灵感空间。每一个笔记本，都是一个新的起点。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-2xl gap-2 border-2 px-4 font-bold backdrop-blur-sm hover:bg-muted/50 transition-all"
                onClick={handleImportClick}
              >
                <Upload className="w-3.5 h-3.5" /> 导入数据
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-2xl gap-2 border-2 px-4 font-bold backdrop-blur-sm hover:bg-muted/50 transition-all"
                onClick={() => ExportService.exportData()}
              >
                <Download className="w-3.5 h-3.5" /> 导出备份
              </Button>
              <Button
                onClick={() => setIsCreating(true)}
                className="h-9 rounded-2xl gap-2 px-6 font-black shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
              >
                <Plus className="w-4 h-4" /> 新建笔记本
              </Button>
            </div>
          </div>

          {isCreating && (
            <Card className="border-primary/20 bg-primary/5 shadow-inner rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
              <CardContent className="p-4 flex flex-col gap-3">
                <Input
                  autoFocus
                  className="h-10 text-sm rounded-xl flex-1 bg-background border-2 focus-visible:ring-primary"
                  placeholder="输入笔记本名称..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <div className="flex gap-2 justify-end">
                  <Button onClick={handleCreate} className="h-9 px-5 rounded-xl font-bold">
                    确认创建
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setIsCreating(false)}
                    className="h-9 px-4 rounded-xl font-bold"
                  >
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {notebooks?.map((nb) => (
              <Card
                key={nb.id}
                className="group relative bg-card/40 backdrop-blur-md border border-border/50 hover:border-primary/50 transition-all duration-500 rounded-2xl overflow-hidden flex flex-col"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
                      <NotebookIcon className="w-5 h-5" />
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[160px]">
                        <DropdownMenuItem
                          onClick={() => handlePull(nb.id)}
                          className="rounded-xl gap-2 cursor-pointer"
                        >
                          <CloudDownload className="w-4 h-4" /> 从云端拉取
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingId(nb.id);
                            setEditName(nb.name);
                          }}
                          className="rounded-xl gap-2 cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" /> 重命名
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive rounded-xl gap-2 cursor-pointer"
                          onClick={() => handleDelete(nb.id)}
                        >
                          <Trash2 className="w-4 h-4" /> 删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {editingId === nb.id ? (
                    <div className="space-y-2">
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(nb.id)}
                        className="rounded-xl border-2 h-9 text-sm"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleRename(nb.id)}
                          className="rounded-lg"
                        >
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg"
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Link
                        to={`/s/${createNotebookToken(nb.id, nb.name)}`}
                        className="block group/title"
                      >
                        <CardTitle className="text-xl font-black tracking-tight group-hover/title:text-primary transition-colors leading-tight line-clamp-2">
                          {nb.name}
                        </CardTitle>
                      </Link>
                      <p className="text-[10px] text-muted-foreground mt-2 font-black uppercase tracking-widest opacity-40">
                        ID: {nb.id.slice(0, 8)}...
                      </p>
                    </>
                  )}
                </CardHeader>

                <CardFooter
                  className="p-5 pt-0 flex justify-between items-center text-xs font-bold text-muted-foreground/60"
                  suppressHydrationWarning
                >
                  <div className="flex items-center gap-1.5 bg-muted/30 px-2.5 py-1 rounded-full">
                    <Calendar className="w-3 h-3 opacity-70" />
                    <span>{new Date(nb.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => handleSync(nb.id)}
                      disabled={syncingId === nb.id}
                      title="立即同步"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${syncingId === nb.id ? 'animate-spin' : ''}`}
                      />
                    </Button>
                    <Link to={`/s/${createNotebookToken(nb.id, nb.name)}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full font-black text-primary hover:bg-primary hover:text-primary-foreground transition-all gap-1 px-3 h-8 text-xs"
                      >
                        进入 <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </CardFooter>
              </Card>
            ))}

            {notebooks?.length === 0 && !isCreating && remoteNotebooks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-card/40 backdrop-blur-md rounded-3xl border-2 border-dashed border-border/60">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary/40">
                  <NotebookIcon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black tracking-tight mb-3">没有发现笔记本</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8 font-medium leading-relaxed">
                  灵感的第一步是为它准备一个家。
                  <br />
                  现在就创建你的第一个笔记本吧。
                </p>
                <Button
                  onClick={() => setIsCreating(true)}
                  className="h-10 rounded-2xl gap-2 px-8 font-black shadow-lg shadow-primary/20 transition-all"
                >
                  <Plus className="w-4 h-4" /> 立即创建
                </Button>
              </div>
            )}
          </div>

          {remoteNotebooks.filter((rnb) => !notebooks?.some((nb) => nb.id === rnb.id)).length >
            0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center gap-3 pt-6 border-t border-border/40">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                  <Cloud className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-black tracking-tight uppercase">云端笔记本</h2>
                  <p className="text-xs text-muted-foreground font-semibold">
                    发现你在其他设备上存储的备份
                  </p>
                </div>
                {isLoadingRemote && <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />}
              </div>

              <div className="grid gap-4">
                {remoteNotebooks
                  .filter((rnb) => !notebooks?.some((nb) => nb.id === rnb.id))
                  .map((rnb) => (
                    <Card
                      key={rnb.id}
                      className="group bg-blue-500/5 backdrop-blur-md border border-blue-500/20 hover:border-blue-500/50 transition-all duration-500 rounded-2xl overflow-hidden flex flex-col"
                    >
                      <CardHeader className="p-5">
                        <CardTitle className="text-lg font-black tracking-tight line-clamp-2">
                          {rnb.name}
                        </CardTitle>
                        <p className="text-[10px] text-blue-500/60 mt-2 font-black uppercase tracking-widest">
                          ID: {rnb.id.slice(0, 8)}...
                        </p>
                      </CardHeader>
                      <CardFooter className="p-5 pt-0">
                        <Button
                          className="w-full h-10 rounded-xl gap-2 font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                          onClick={() => handleRestore(rnb.id)}
                          disabled={syncingId === rnb.id}
                        >
                          {syncingId === rnb.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CloudDownload className="w-4 h-4" />
                          )}
                          同步到本地
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl backdrop-blur-xl bg-background/80">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black tracking-tight">
              确定要删除吗？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              此操作无法撤销。该笔记本及其所有笔记将从本地数据库中永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl font-bold">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
