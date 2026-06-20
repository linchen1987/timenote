import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';

export interface VaultEntry {
  projectId: string;
  name: string;
  path: string;
}

interface DesktopConfig {
  vaults: VaultEntry[];
}

const CONFIG_FILENAME = 'config.json';
const EMPTY_CONFIG: DesktopConfig = { vaults: [] };

let configDir: string | null = null;
let configPath: string | null = null;
let cache: DesktopConfig = { ...EMPTY_CONFIG };

async function ensurePaths(): Promise<void> {
  if (!configDir) {
    configDir = await invoke<string>('config_dir');
    configPath = await join(configDir, CONFIG_FILENAME);
  }
}

export async function loadConfig(): Promise<DesktopConfig> {
  await ensurePaths();
  const exists = await invoke<boolean>('fs_exists', { path: configPath! });
  if (!exists) return { ...EMPTY_CONFIG };
  try {
    const raw = await invoke<string>('fs_read_text_file', { path: configPath! });
    const parsed = JSON.parse(raw) as Partial<DesktopConfig>;
    cache = {
      vaults: parsed.vaults ?? [],
    };
  } catch {
    cache = { ...EMPTY_CONFIG };
  }
  return cache;
}

async function persist(): Promise<void> {
  await ensurePaths();
  await invoke<void>('fs_mkdir', { path: configDir! });
  await invoke<void>('fs_write_text_file', {
    path: configPath!,
    content: JSON.stringify(cache, null, 2),
  });
}

export function getConfig(): DesktopConfig {
  return cache;
}

export async function saveVaultEntries(vaults: VaultEntry[]): Promise<void> {
  cache.vaults = vaults;
  await persist();
}

export async function addVaultEntry(entry: VaultEntry): Promise<void> {
  const idx = cache.vaults.findIndex((v) => v.projectId === entry.projectId);
  if (idx >= 0) cache.vaults[idx] = entry;
  else cache.vaults.push(entry);
  await persist();
}

export async function removeVaultEntry(projectId: string): Promise<void> {
  cache.vaults = cache.vaults.filter((v) => v.projectId !== projectId);
  await persist();
}
