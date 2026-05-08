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
  useNotebooksPage,
  useTheme,
} from '@timenote/ui';
import {
  ArrowRight,
  ArrowRightLeft,
  Download,
  Edit2,
  Github,
  Globe,
  LayoutGrid,
  Moon,
  MoreVertical,
  Notebook as NotebookIcon,
  Plus,
  Settings,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router';
import { useVaultStore } from '../../lib/vault-store';

function ThemeToggle() {
  const { setTheme } = useTheme();

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
    hasLegacyData,
    importInputRef,
    handleCreate,
    handleDelete,
    handleExport,
    handleImport,
    getNotebookLink,
  } = useNotebooksPage(useVaultStore, {
    messages: { created: '笔记本创建成功', deleted: '笔记本已删除' },
  });

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
          {hasLegacyData && (
            <Link
              to="/migration"
              className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 transition-colors"
            >
              <ArrowRightLeft className="w-5 h-5 shrink-0" />
              <span className="text-sm font-bold">发现旧版笔记本，点击迁移到新架构</span>
              <ArrowRight className="w-4 h-4 ml-auto shrink-0" />
            </Link>
          )}

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
                ref={importInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleImport}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-2xl gap-2 border-2 px-4 font-bold backdrop-blur-sm hover:bg-muted/50 transition-all"
                onClick={() => importInputRef.current?.click()}
                disabled={isImporting}
              >
                <Upload className="w-3.5 h-3.5" /> {isImporting ? '导入中...' : '导入笔记本'}
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
            {vaults.map((v) => (
              <Card
                key={v.projectId}
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
                    <div className="space-y-2">
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-xl border-2 h-9 text-sm"
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
                        <CardTitle className="text-xl font-black tracking-tight group-hover/title:text-primary transition-colors leading-tight line-clamp-2">
                          {v.name}
                        </CardTitle>
                      </Link>
                      <p className="text-[10px] text-muted-foreground mt-2 font-black uppercase tracking-widest opacity-40">
                        ID: {v.projectId}
                      </p>
                    </>
                  )}
                </CardHeader>

                <CardFooter className="p-5 pt-0 flex justify-end items-center">
                  <Link to={getNotebookLink(v)}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full font-black text-primary hover:bg-primary hover:text-primary-foreground transition-all gap-1 px-3 h-8 text-xs"
                    >
                      进入 <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}

            {vaults.length === 0 && !isCreating && (
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
