import { type LogEntry, parseNotebookId } from '@timenote/core';
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '../page-header';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import type { UseVaultStoreHook } from './use-notebooks-page';

const DEFAULT_CATEGORIES = ['sync', 'remote', 'system'] as const;

const LEVEL_COLOR: Record<string, string> = {
  debug: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
  info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  warn: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  error: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

export interface NotebookLogsPageProps {
  useVaultStore: UseVaultStoreHook;
  notebookToken: string;
}

export function NotebookLogsPage({ useVaultStore, notebookToken }: NotebookLogsPageProps) {
  const projectId = parseNotebookId(notebookToken);
  const store = useVaultStore;

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.category);
    return [
      ...DEFAULT_CATEGORIES.filter((c) => set.has(c)),
      ...[...set].filter((c) => !(DEFAULT_CATEGORIES as readonly string[]).includes(c)),
    ];
  }, [entries]);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const list = await store.getState().readLogs(projectId);
      setEntries(list);
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [projectId, store]);

  useEffect(() => {
    if (!projectId) return;
    reload();
  }, [projectId, reload]);

  const handleClear = async () => {
    if (!projectId) return;
    try {
      await store.getState().clearLogs(projectId);
      setEntries([]);
      toast.success('Logs cleared');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  };

  const toggleExpand = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const visible = filter === 'all' ? entries : entries.filter((e) => e.category === filter);

  return (
    <>
      <PageHeader
        title="Diagnostics Logs"
        leftActions={
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/s/${notebookToken}/settings`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
        }
      >
        <Button variant="ghost" size="icon" onClick={reload} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleClear} disabled={!projectId}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </PageHeader>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Label className="text-xs text-muted-foreground">Filter</Label>
          {['all', ...categories].map((c) => (
            <Button
              key={c}
              variant={filter === c ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(c)}
            >
              {c}
            </Button>
          ))}
        </div>

        {visible.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {loading ? 'Loading...' : 'No log entries.'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {visible.map((entry, i) => {
              const isOpen = expanded.has(i);
              return (
                <Card key={`${entry.ts}-${i}`} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(i)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-muted">
                          {entry.category}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${LEVEL_COLOR[entry.level] ?? ''}`}
                        >
                          {entry.level}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {formatTime(entry.ts)}
                        </span>
                      </div>
                      <p className="text-sm font-mono break-all">{entry.message}</p>
                    </div>
                  </button>
                  {isOpen && entry.data ? (
                    <pre className="px-4 pb-3 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground bg-muted/30 rounded-md m-2 mt-0 p-3">
                      {JSON.stringify(entry.data, null, 2)}
                    </pre>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
