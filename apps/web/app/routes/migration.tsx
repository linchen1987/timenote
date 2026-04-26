'use client';

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
  CardHeader,
  CardTitle,
} from '@timenote/ui';
import { ArrowLeft, Download, Loader2, Notebook as NotebookIcon, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, type MetaFunction } from 'react-router';
import { toast } from 'sonner';
import { type LegacyNotebookInfo, useVaultStore } from '~/lib/vault-store';

export const meta: MetaFunction = () => {
  return [{ title: '数据迁移 - Time Note' }];
};

export default function MigrationPage() {
  const {
    checkMigration,
    listLegacyNotebooks,
    migrateLegacyNotebook,
    clearLegacyData,
    migrationStatus,
    migrationProgress,
  } = useVaultStore();

  const [notebooks, setNotebooks] = useState<LegacyNotebookInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const needs = await checkMigration();
      if (needs) {
        const list = await listLegacyNotebooks();
        setNotebooks(list);
      } else {
        setNotebooks([]);
      }
    } catch (e) {
      toast.error(`Failed to check migration: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [checkMigration, listLegacyNotebooks]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async (nb: LegacyNotebookInfo) => {
    setExportingId(nb.id);
    try {
      const result = await migrateLegacyNotebook(nb.id);
      toast.success(`"${result.notebookName}" exported (${result.notesCount} notes)`);
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} errors during export`);
      }
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setExportingId(null);
    }
  };

  const handleExportAll = async () => {
    for (const nb of notebooks) {
      setExportingId(nb.id);
      try {
        const result = await migrateLegacyNotebook(nb.id);
        toast.success(`"${result.notebookName}" exported (${result.notesCount} notes)`);
      } catch (e) {
        toast.error(`"${nb.name}" export failed: ${(e as Error).message}`);
      }
    }
    setExportingId(null);
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await clearLegacyData();
      toast.success('Legacy data cleared');
      setNotebooks([]);
      setIsClearDialogOpen(false);
    } catch (e) {
      toast.error(`Clear failed: ${(e as Error).message}`);
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <nav className="border-b border-border/40 bg-background/60 backdrop-blur-2xl">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link
            to="/s/list"
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 返回笔记本列表
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">数据迁移</h1>
          <p className="text-muted-foreground font-medium">
            将旧版笔记本导出为 ZIP 文件，然后通过「导入笔记本」功能导入到新架构。
          </p>
        </div>

        {notebooks.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground font-medium">没有发现旧版数据</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-medium">
                发现 {notebooks.length} 个旧版笔记本
              </p>
              <Button
                onClick={handleExportAll}
                disabled={migrationStatus === 'migrating'}
                size="sm"
                className="rounded-xl gap-2"
              >
                <Download className="w-4 h-4" /> 全部导出
              </Button>
            </div>

            <div className="space-y-4">
              {notebooks.map((nb) => (
                <Card key={nb.id} className="rounded-2xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                          <NotebookIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold">{nb.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{nb.noteCount} 条笔记</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleExport(nb)}
                        disabled={exportingId === nb.id || migrationStatus === 'migrating'}
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-2"
                      >
                        {exportingId === nb.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> 导出中...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" /> 导出 ZIP
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  {exportingId === nb.id && migrationProgress && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {migrationProgress.phase === 'reading'
                              ? '正在读取...'
                              : `正在写入 ${migrationProgress.current}/${migrationProgress.total}`}
                          </span>
                          <span>
                            {migrationProgress.total > 0
                              ? Math.round(
                                  (migrationProgress.current / migrationProgress.total) * 100,
                                )
                              : 0}
                            %
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                migrationProgress.total > 0
                                  ? (migrationProgress.current / migrationProgress.total) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            <div className="pt-8 border-t border-border/40">
              <Card className="rounded-2xl border-destructive/20 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-destructive">清除旧数据</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    导出完成后，可以清除浏览器中存储的旧版数据。此操作不可恢复。
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-xl gap-2"
                    onClick={() => setIsClearDialogOpen(true)}
                    disabled={isClearing}
                  >
                    <Trash2 className="w-4 h-4" /> 清除本地旧数据
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>

      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>确定要清除所有旧数据吗？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除浏览器中存储的所有旧版笔记本、笔记、标签和菜单数据。此操作不可恢复。请确保已导出需要保留的数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl font-bold">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
            >
              确认清除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
