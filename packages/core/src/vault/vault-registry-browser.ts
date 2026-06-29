import { STORAGE_KEYS } from '../constants';
import { createOpfsClient } from '../fs/adapters/localfs/opfs';
import type { FsClient } from '../fs/types';
import type { VaultRegistry, VaultRegistryEntry } from './vault-registry';
import { migrateOpfsToStoredRegistry } from './vault-registry-migration';

interface StoredEntry {
  projectId: string;
  sourceUrl: string;
  name: string;
}

function isBrowser(): boolean {
  return typeof localStorage !== 'undefined';
}

function loadEntries(): StoredEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VAULT_REGISTRY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredEntry[]) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: StoredEntry[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEYS.VAULT_REGISTRY, JSON.stringify(entries));
}

export async function createBrowserVaultRegistry(): Promise<VaultRegistry> {
  const opfsRoot = await navigator.storage.getDirectory();
  const vaultsDir = await opfsRoot.getDirectoryHandle('vaults', { create: true });
  await migrateOpfsToStoredRegistry(vaultsDir);
  return new BrowserVaultRegistryImpl(vaultsDir);
}

class BrowserVaultRegistryImpl implements VaultRegistry {
  constructor(private vaultsDir: FileSystemDirectoryHandle) {}

  async list(): Promise<VaultRegistryEntry[]> {
    return loadEntries();
  }

  async get(projectId: string): Promise<VaultRegistryEntry | null> {
    const entries = loadEntries();
    return entries.find((e) => e.projectId === projectId) ?? null;
  }

  async register(projectId: string, name: string): Promise<VaultRegistryEntry> {
    await this.vaultsDir.getDirectoryHandle(projectId, { create: true });
    return this.upsertEntry(projectId, name);
  }

  async unregister(projectId: string): Promise<void> {
    const entries = loadEntries().filter((e) => e.projectId !== projectId);
    saveEntries(entries);
  }

  async destroy(projectId: string): Promise<void> {
    try {
      await this.vaultsDir.removeEntry(projectId, { recursive: true });
    } catch {}
    const entries = loadEntries().filter((e) => e.projectId !== projectId);
    saveEntries(entries);
  }

  async getLocalClient(projectId: string): Promise<FsClient> {
    const dir = await this.vaultsDir.getDirectoryHandle(projectId, { create: true });
    return createOpfsClient(dir);
  }

  private upsertEntry(projectId: string, name: string): VaultRegistryEntry {
    const sourceUrl = `localfs:///vaults/${projectId}`;
    const entry: StoredEntry = { projectId, sourceUrl, name };
    const entries = loadEntries().filter((e) => e.projectId !== projectId);
    entries.push(entry);
    saveEntries(entries);
    return entry;
  }
}
