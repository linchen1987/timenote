import { generateProjectId, initVault } from '@timenote/core';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from '@timenote/ui';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { basename, join } from '@tauri-apps/api/path';
import { useState } from 'react';
import { toast } from 'sonner';
import { getDesktopRegistry, useVaultStore } from './vault-store';
import { TauriFsClient } from './tauri-fs-driver';
import { FolderPlus, Loader2 } from 'lucide-react';

interface CreateVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateVaultDialog({ open: onOpen, onOpenChange }: CreateVaultDialogProps) {
  const [vaultDir, setVaultDir] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleBrowse = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === 'string') {
      setVaultDir(selected);
      if (!name.trim()) {
        setName(await basename(selected));
      }
    }
  };

  const handleCreate = async () => {
    if (!vaultDir.trim() || !name.trim()) return;
    setCreating(true);
    let initialized = false;
    try {
      const manifestDir = await join(vaultDir, '.timenote');
      if (await invoke<boolean>('fs_exists', { path: manifestDir })) {
        toast.error('该目录已是 vault，请选择其他目录');
        return;
      }

      const projectId = generateProjectId();
      const registry = await getDesktopRegistry();
      await registry.registerExisting(projectId, vaultDir, name.trim());

      const transport = new TauriFsClient(vaultDir);
      await initVault(transport, projectId, name.trim());
      initialized = true;

      toast.success(`已创建: ${name.trim()}`);
      setName('');
      setVaultDir('');
      onOpenChange(false);
      await useVaultStore.getState().listVaults();
    } catch (e) {
      console.error('[createVault] failed:', e);
      if (initialized) {
        await invoke<void>('fs_remove', { path: vaultDir, recursive: true }).catch(() => {});
      }
      const msg = typeof e === 'string' ? e : (e as Error)?.message ?? String(e);
      toast.error(`创建失败: ${msg}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={onOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建笔记本</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="vault-location" className="text-sm font-medium text-muted-foreground">目录</label>
            <div className="flex gap-2">
              <Input
                id="vault-location"
                readOnly
                placeholder="选择笔记本目录..."
                value={vaultDir}
                className="flex-1 text-sm normal-case"
              />
              <Button variant="outline" onClick={handleBrowse} className="shrink-0 gap-2">
                <FolderPlus className="w-4 h-4" /> 浏览
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="vault-name" className="text-sm font-medium text-muted-foreground">名称</label>
            <Input
              id="vault-name"
              autoFocus
              placeholder="输入笔记本名称..."
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && !creating && handleCreate()}
              className="text-sm normal-case"
            />
          </div>
          {vaultDir && (
            <p className="text-xs text-muted-foreground normal-case">
              vault 将创建于: {vaultDir}/.timenote/
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
            取消
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!vaultDir.trim() || !name.trim() || creating}
            className="gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
