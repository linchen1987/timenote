import { computeVolumeUrl, STORAGE_KEYS, type FsVolumeAccess } from '@timenote/core';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';

export interface VaultEntry {
  projectId: string;
  name: string;
  path: string;
}

export type VolumeAccessEntry = FsVolumeAccess & { volumeUrl: string };

interface DesktopConfig {
  vaults: VaultEntry[];
  providers: VolumeAccessEntry[];
}

const CONFIG_FILENAME = 'config.json';
const EMPTY_CONFIG: DesktopConfig = { vaults: [], providers: [] };

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
      providers: parsed.providers ?? [],
    };
  } catch {
    cache = { ...EMPTY_CONFIG };
  }
  return cache;
}

async function persist(): Promise<void> {
  await ensurePaths();
  await invoke<void>('fs_mkdir', { path: configDir! });
  await invoke<void>('fs_write_text_file', { path: configPath!, content: JSON.stringify(cache, null, 2) });
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

export async function saveProviders(providers: VolumeAccessEntry[]): Promise<void> {
  cache.providers = providers;
  await persist();
}

export async function migrateFromLegacy(): Promise<void> {
  await ensurePaths();
  const exists = await invoke<boolean>('fs_exists', { path: configPath! });
  if (exists) return;

  const migrated: DesktopConfig = { vaults: [], providers: [] };

  // Migrate vaults from appDataDir/vaults.json
  try {
    const oldRegistryPath = await join(await appDataDir(), 'vaults.json');
    const oldExists = await invoke<boolean>('fs_exists', { path: oldRegistryPath });
    if (oldExists) {
      const raw = await invoke<string>('fs_read_text_file', { path: oldRegistryPath });
      const oldData = JSON.parse(raw) as { vaults?: VaultEntry[] };
      migrated.vaults = oldData.vaults ?? [];
    }
  } catch {}

  // Migrate providers from localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROVIDERS);
    if (raw) {
      const entries = JSON.parse(raw) as Record<string, unknown>[];
      const { normalizeLegacyEntry } = await import('@timenote/ui');
      for (const item of entries) {
        const result = normalizeLegacyEntry(item);
        if (result) migrated.providers.push(result.entry);
      }
    }
  } catch {}

  cache = migrated;
  await persist();

  // Clean up legacy
  try {
    localStorage.removeItem(STORAGE_KEYS.PROVIDERS);
  } catch {}
}
