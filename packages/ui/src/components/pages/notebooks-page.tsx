import { CONTACT_EMAIL } from '@timenote/core';
import {
  ArrowRight,
  Cloud,
  CloudDownload,
  Download,
  Edit2,
  Github,
  Globe,
  LayoutGrid,
  Loader2,
  Mail,
  Monitor,
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
import { Link } from 'react-router';
import { useTheme } from '../theme-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { type UseVaultStoreHook, useNotebooksPage } from './use-notebooks-page';
import { useProviderScanner } from './use-provider-scanner';

export interface NotebooksPageProps {
  useVaultStore: UseVaultStoreHook;
  logoSrc?: string;
  messages?: {
    created?: string;
    deleted?: string;
    exported?: string;
    pulled?: string;
  };
}

function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full w-10 h-10 text-muted-foreground hover:text-foreground"
        >
          <Sun className="w-5 h-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute w-5 h-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="rounded-xl gap-2 cursor-pointer font-medium"
        >
          <Monitor className="w-4 h-4 text-primary" /> <span>系统设置</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProviderScanner({
  useStore,
  localVaults,
  onPullSuccess,
}: {
  useStore: UseVaultStoreHook;
  localVaults: Array<{ projectId: string; name: string }>;
  onPullSuccess: () => Promise<void>;
}) {
  const scanner = useProviderScanner(useStore, localVaults, onPullSuccess);

  if (scanner.providers.length === 0) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center gap-4 pt-8 border-t border-border/40">
        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
          <Cloud className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight">云端笔记本</h2>
          <p className="text-sm text-muted-foreground">点击扫描按钮查看远程存储中的笔记本</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => {
            scanner.setShowManualPull(!scanner.showManualPull);
            scanner.setManualProviderId(scanner.providers[0]?.volumeUrl ?? '');
          }}
        >
          手动拉取
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        {scanner.providers.map((p) => (
          <div key={p.volumeUrl} className="flex items-center gap-2 p-3 rounded-xl border bg-card">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs truncate max-w-[200px]">{p.volumeUrl}</p>
              <p className="text-[10px] text-muted-foreground">{p.scheme?.toUpperCase()}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => scanner.handleScan(p.volumeUrl)}
              disabled={scanner.scanningId === p.volumeUrl}
            >
              {scanner.scanningId === p.volumeUrl ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-1">扫描</span>
            </Button>
          </div>
        ))}
      </div>

      {scanner.showManualPull && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="manual-provider" className="text-sm font-medium">
                Provider
              </label>
              <select
                id="manual-provider"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={scanner.manualProviderId}
                onChange={(e) => scanner.setManualProviderId(e.target.value)}
              >
                {scanner.providers.map((p) => (
                  <option key={p.volumeUrl} value={p.volumeUrl}>
                    {p.volumeUrl}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="manual-path" className="text-sm font-medium">
                Path
              </label>
              <Input
                id="manual-path"
                value={scanner.manualPath}
                onChange={(e) => scanner.setManualPath(e.target.value)}
                placeholder="timenote/vaults/{project_id} or custom path"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={scanner.handleManualPull}
                disabled={
                  !scanner.manualProviderId || !scanner.manualPath || scanner.isPulling === 'manual'
                }
              >
                {scanner.isPulling === 'manual' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CloudDownload className="w-4 h-4 mr-2" />
                )}
                拉取
              </Button>
              <Button variant="ghost" onClick={() => scanner.setShowManualPull(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {scanner.remoteOnlyVaults.length > 0 && (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {scanner.remoteOnlyVaults.map((v) => (
            <Card
              key={v.projectId}
              className="group bg-blue-500/5 backdrop-blur-md border border-blue-500/20 hover:border-blue-500/50 transition-all duration-500 rounded-[2.5rem] overflow-hidden flex flex-col h-full"
            >
              <CardHeader className="p-8 pb-4">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                    <Cloud className="w-7 h-7" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-black tracking-tight leading-tight line-clamp-2">
                  {v.name}
                </CardTitle>
                <p className="text-[10px] text-muted-foreground mt-4 font-black uppercase tracking-widest opacity-40">
                  ID: {v.projectId}
                </p>
              </CardHeader>

              <div className="flex-1" />

              <CardFooter className="p-8 pt-0 flex justify-end items-center">
                <Button
                  onClick={() => scanner.handlePull(v.providerId, v.path)}
                  disabled={scanner.isPulling === `${v.providerId}:${v.path}`}
                  className="rounded-full font-black bg-blue-500 hover:bg-blue-600 text-white gap-2 px-4"
                >
                  {scanner.isPulling === `${v.providerId}:${v.path}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CloudDownload className="w-4 h-4" />
                  )}
                  拉取到本地
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function NotebooksPage({ useVaultStore: useStore, logoSrc, messages }: NotebooksPageProps) {
  const {
    vaults,
    isCreating,
    setIsCreating,
    newName,
    setNewName,
    editingId,
    setEditingId,
    editName,
    setEditName,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    setVaultToDelete,
    isExporting,
    isImporting,
    importInputRef,
    handleCreate,
    handleDelete,
    handleExport,
    handleImport,
    getNotebookLink,
    refresh,
  } = useNotebooksPage(useStore, messages ? { messages } : undefined);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 relative overflow-x-hidden font-sans flex flex-col">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-primary/10 rounded-full blur-[120px] opacity-60 animate-pulse" />
        <div
          className="absolute bottom-[5%] right-[-5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] opacity-40 animate-pulse"
          style={{ animationDelay: '3s' }}
        />
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px 50px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
      </div>

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-3 group transition-transform hover:scale-105 active:scale-95"
          >
            {logoSrc && (
              <div className="w-7 h-7">
                <img src={logoSrc} alt="Time Note" className="w-full h-full drop-shadow-sm" />
              </div>
            )}
            <span className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/80 to-foreground/60 uppercase">
              Time Note
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 mr-2 border-r border-border/40 pr-4 text-muted-foreground">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="rounded-full w-10 h-10 hover:text-foreground hover:bg-accent transition-colors"
              >
                <a
                  href="https://github.com/linchen1987/timenote"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="GitHub 仓库"
                >
                  <Github className="w-5 h-5" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="rounded-full w-10 h-10 hover:text-foreground hover:bg-accent transition-colors"
              >
                <a
                  href="https://link1987.site"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="作者主页"
                >
                  <Globe className="w-5 h-5" />
                </a>
              </Button>
            </div>
            <ThemeToggle />
            <Link to="/settings">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-10 h-10 text-muted-foreground hover:text-foreground"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-32 pb-20 px-6 flex-1">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 animate-fade-in">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black tracking-widest uppercase">
                <LayoutGrid className="w-3 h-3" />
                <span>My Workspace</span>
              </div>
              <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-none uppercase">
                笔记本
              </h1>
              <p className="text-xl text-muted-foreground font-semibold max-w-2xl opacity-80">
                管理和组织你的灵感空间。每一个笔记本，都是一个新的起点。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                ref={importInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleImport}
              />
              <Button
                onClick={() => importInputRef.current?.click()}
                size="lg"
                variant="outline"
                disabled={isImporting}
                className="h-12 rounded-2xl gap-2 px-8 font-black"
              >
                <Upload className="w-5 h-5" /> {isImporting ? '导入中...' : '导入笔记本'}
              </Button>
              <Button
                onClick={() => setIsCreating(true)}
                size="lg"
                className="h-12 rounded-2xl gap-2 px-8 font-black shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
              >
                <Plus className="w-5 h-5" /> 新建笔记本
              </Button>
            </div>
          </div>

          {isCreating && (
            <Card className="border-primary/20 bg-primary/5 shadow-inner rounded-[2rem] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
              <CardContent className="p-6 flex flex-col sm:flex-row gap-4 items-center">
                <Input
                  autoFocus
                  className="h-14 text-lg rounded-xl flex-1 bg-background border-2 focus-visible:ring-primary"
                  placeholder="输入笔记本名称..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button
                    onClick={handleCreate}
                    className="h-14 px-8 rounded-xl font-bold flex-1 sm:flex-none"
                  >
                    确认创建
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setIsCreating(false)}
                    className="h-14 px-6 rounded-xl font-bold flex-1 sm:flex-none"
                  >
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {vaults.map((v) => (
              <Card
                key={v.projectId}
                className="group relative bg-card/40 backdrop-blur-md border border-border/50 hover:border-primary/50 transition-all duration-500 rounded-[2.5rem] overflow-hidden hover:shadow-[0_20px_50px_-12px_rgba(var(--primary-rgb),0.15)] flex flex-col h-full"
              >
                <CardHeader className="p-8 pb-4 relative">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 ease-spring">
                      <NotebookIcon className="w-7 h-7" />
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[160px]">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingId(v.projectId);
                            setEditName(v.name);
                          }}
                          className="rounded-xl gap-2 cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" /> 重命名
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-xl gap-2 cursor-pointer"
                          onClick={() => handleExport(v.projectId)}
                          disabled={isExporting === v.projectId}
                        >
                          <Download className="w-4 h-4" /> 导出
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive rounded-xl gap-2 cursor-pointer"
                          onClick={() => {
                            setVaultToDelete(v.projectId);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" /> 删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {editingId === v.projectId ? (
                    <div className="space-y-3">
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-xl border-2"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" className="rounded-lg" disabled>
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
                      <Link to={getNotebookLink(v)} className="block group/title">
                        <CardTitle className="text-3xl font-black tracking-tight group-hover/title:text-primary transition-colors leading-tight line-clamp-2">
                          {v.name}
                        </CardTitle>
                      </Link>
                      <p className="text-[10px] text-muted-foreground mt-4 font-black uppercase tracking-widest opacity-40">
                        ID: {v.projectId}
                      </p>
                    </>
                  )}
                </CardHeader>

                <div className="flex-1" />

                <CardFooter className="p-8 pt-0 flex justify-end items-center">
                  <Link to={getNotebookLink(v)}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full font-black text-primary hover:bg-primary hover:text-primary-foreground transition-all gap-1 px-4"
                    >
                      进入 <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}

            {vaults.length === 0 && !isCreating && (
              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 flex flex-col items-center justify-center py-32 text-center bg-card/40 backdrop-blur-md rounded-[3rem] border-2 border-dashed border-border/60">
                <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mb-8 text-primary/40">
                  <NotebookIcon className="w-12 h-12" />
                </div>
                <h3 className="text-3xl font-black tracking-tight mb-4">没有发现笔记本</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-10 font-medium leading-relaxed">
                  灵感的第一步是为它准备一个家。
                  <br />
                  现在就创建你的第一个笔记本吧。
                </p>
                <Button
                  onClick={() => setIsCreating(true)}
                  size="lg"
                  className="h-16 rounded-2xl gap-3 px-10 font-black shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                >
                  <Plus className="w-6 h-6" /> 立即创建
                </Button>
              </div>
            )}
          </div>

          <ProviderScanner useStore={useStore} localVaults={vaults} onPullSuccess={refresh} />
        </div>
      </main>

      <footer className="border-t border-border/40 py-20 px-6 bg-background/50 backdrop-blur-sm relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
            <div className="space-y-4">
              <Link to="/" className="flex items-center gap-3">
                {logoSrc && <img src={logoSrc} alt="Logo" className="w-7 h-7" />}
                <span className="text-lg font-black tracking-tighter uppercase">Time Note</span>
              </Link>
              <p className="text-sm font-bold text-muted-foreground/60 max-w-xs">
                Built with passion for thinkers.
                <br />
                记录不仅仅是记录，更是与自己对话的过程。
              </p>
            </div>

            <div className="flex flex-wrap gap-8 items-center">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(CONTACT_EMAIL);
                }}
                className="flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
              >
                <Mail className="w-4 h-4 text-primary" /> Email
              </button>
              <a
                href="https://github.com/linchen1987/timenote"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
              >
                <Github className="w-4 h-4 text-primary" /> GitHub
              </a>
              <a
                href="https://link1987.site"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
              >
                <Globe className="w-4 h-4 text-primary" /> Author
              </a>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-border/10 flex justify-between items-center">
            <p className="text-[10px] font-black tracking-widest text-muted-foreground/30 uppercase">
              © 2026 Time Note. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <span className="text-[10px] font-black tracking-widest text-muted-foreground/20 uppercase">
                Designed with ❤️ for clarity
              </span>
            </div>
          </div>
        </div>
      </footer>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl backdrop-blur-xl bg-background/80">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black tracking-tight">
              确定要删除吗？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium">
              此操作无法撤销。该笔记本及其所有笔记将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl font-bold">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
