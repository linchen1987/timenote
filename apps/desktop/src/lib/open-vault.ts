import type { VaultRegistryEntry } from '@timenote/core';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';

type DesktopRegistry = Awaited<ReturnType<typeof import('./tauri-vault-registry').createDesktopVaultRegistry>>;

export async function pickAndRegisterVault(
  registry: DesktopRegistry,
): Promise<VaultRegistryEntry | null> {
  const selected = await open({ directory: true, multiple: false });
  if (!selected || typeof selected !== 'string') return null;

  const manifestPath = await join(selected, '.timenote', 'manifest.json');
  const exists = await invoke<boolean>('fs_exists', { path: manifestPath });
  if (!exists) {
    throw new Error('所选目录不是有效的 TimeNote vault（缺少 .timenote/manifest.json）');
  }

  const raw = await invoke<string>('fs_read_text_file', { path: manifestPath });
  const manifest = JSON.parse(raw);
  const projectId = manifest.project_id as string;
  const name = (manifest.name as string) || projectId;

  return registry.registerExisting(projectId, selected, name);
}
