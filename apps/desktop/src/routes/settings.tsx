import { invoke } from '@tauri-apps/api/core';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SettingsPage as SharedSettingsPage,
} from '@timenote/ui';
import { Copy } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { testProviderConnection } from '../lib/fs-service';
import { getDesktopRegistry, useVaultStore } from '../lib/vault-store';

interface AutomationStatus {
  enabled: boolean;
  running: boolean;
  endpoint: string | null;
  protocolVersion: number;
  runtimes: number;
  allowedNotebooks: string[];
}

export function SettingsPage() {
  return (
    <SharedSettingsPage
      useVaultStore={useVaultStore}
      testProviderConnection={testProviderConnection}
      extensionSection={<AgentConnectionSection />}
    />
  );
}

function StatusRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

interface NotebookRowProps {
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  name: string;
  hint: string;
}

function NotebookRow({ checked, disabled, onToggle, name, hint }: NotebookRowProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="size-4 shrink-0 accent-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate font-mono text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function AgentConnectionSection() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [notebooks, setNotebooks] = useState<Array<{ projectId: string; name: string }>>([]);
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const s = await invoke<AutomationStatus>('automation_status');
        setStatus(s);
        setAllowed(s.allowedNotebooks);
      } catch {
        setStatus(null);
      }
      try {
        const registry = await getDesktopRegistry();
        const entries = await registry.list();
        setNotebooks(entries.map((e) => ({ projectId: e.projectId, name: e.name })));
      } catch {
        // registry unavailable: allowlist still editable via status defaults
      }
    })();
  }, []);

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    try {
      setStatus(await invoke<AutomationStatus>('automation_set_enabled', { enabled }));
    } catch (e) {
      toast.error(`切换 Agent 连接失败: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const saveAllowed = async (next: string[]) => {
    setBusy(true);
    try {
      const s = await invoke<AutomationStatus>('automation_set_allowed_notebooks', {
        allowed: next,
      });
      setStatus(s);
      setAllowed(s.allowedNotebooks);
    } catch (e) {
      toast.error(`更新授权范围失败: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText('timenote desktop status');
      toast.success('已复制命令');
    } catch {
      toast.error('复制失败');
    }
  };

  const enabled = status?.enabled ?? false;
  const allAllowed = !allowed || allowed.includes('*');

  const flipNotebook = (projectId: string) => {
    if (!allowed) return;
    if (allAllowed) {
      // from "all" to explicit: every notebook except the toggled one
      const next = notebooks.map((n) => n.projectId).filter((id) => id !== projectId);
      void saveAllowed(next.length === 0 ? ['*'] : next);
      return;
    }
    const next = allowed.includes(projectId)
      ? allowed.filter((id) => id !== projectId)
      : [...allowed, projectId];
    void saveAllowed(next.length === 0 ? ['*'] : next);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Agent 连接</CardTitle>
            <CardDescription>允许本机 AI Agent（CLI / MCP）访问授权的笔记本</CardDescription>
          </div>
          <Button
            variant={enabled ? 'outline' : 'default'}
            size="sm"
            disabled={busy}
            onClick={() => toggle(!enabled)}
          >
            {busy ? '处理中…' : enabled ? '停用' : '启用'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {enabled ? (
          <div className="space-y-6">
            {status && (
              <div className="divide-y divide-border">
                <StatusRow label="服务状态">
                  {status.running ? (
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      运行中
                    </span>
                  ) : (
                    '未运行'
                  )}
                </StatusRow>
                {status.running && status.endpoint && (
                  <StatusRow label="监听地址">
                    <span className="font-mono text-xs">{status.endpoint}</span>
                  </StatusRow>
                )}
                <StatusRow label="协议版本">v{status.protocolVersion}</StatusRow>
                <StatusRow label="在线运行时">{status.runtimes} 个窗口</StatusRow>
              </div>
            )}

            {allowed && notebooks.length > 0 && (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium">可访问的笔记本</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    只有勾选的笔记本能被 agent 读取和修改。
                  </p>
                </div>
                <div className="space-y-2">
                  <NotebookRow
                    checked={allAllowed}
                    disabled={busy}
                    onToggle={() =>
                      void saveAllowed(allAllowed ? notebooks.map((n) => n.projectId) : ['*'])
                    }
                    name="全部笔记本"
                    hint="授权所有已注册的笔记本"
                  />
                  {!allAllowed &&
                    notebooks.map((n) => (
                      <NotebookRow
                        key={n.projectId}
                        checked={allowed.includes(n.projectId)}
                        disabled={busy}
                        onToggle={() => flipNotebook(n.projectId)}
                        name={n.name}
                        hint={n.projectId}
                      />
                    ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">在 agent 环境中运行</p>
                <code className="block truncate font-mono text-sm">timenote desktop status</code>
              </div>
              <button
                type="button"
                onClick={copyCommand}
                title="复制命令"
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Copy className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            启用后，timenote desktop 命令与 MCP
            客户端可以通过本机回环地址操作授权范围内的笔记本。连接凭据仅保存在本机，不会离开这台电脑。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
