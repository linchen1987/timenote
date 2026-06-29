import { STORAGE_KEYS } from '../constants';
import { createOpfsClient } from '../fs/adapters/localfs/opfs';
import { ManifestSchema } from '../spec/manifest';
import { metaPath } from '../spec/vault-layout';

interface StoredEntry {
  projectId: string;
  sourceUrl: string;
  name: string;
}

/**
 * Migrates OPFS-discovered vaults into the localStorage-backed registry.
 *
 * Runs automatically and idempotently: if the migration tombstone exists,
 * it is a no-op. Otherwise it scans the OPFS vaults directory and writes
 * discovered entries to localStorage, then sets the tombstone.
 */
export async function migrateOpfsToStoredRegistry(
  vaultsDir: FileSystemDirectoryHandle,
): Promise<void> {
  if (typeof localStorage === 'undefined') return;

  const tombstone = localStorage.getItem(STORAGE_KEYS.VAULT_REGISTRY_MIGRATED_V1);
  if (tombstone) return;

  const existing = loadRegistryEntries();
  const discovered = await scanOpfsVaults(vaultsDir);

  const merged = mergeEntries(existing, discovered);
  saveRegistryEntries(merged);

  localStorage.setItem(STORAGE_KEYS.VAULT_REGISTRY_MIGRATED_V1, '1');
}

function loadRegistryEntries(): StoredEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VAULT_REGISTRY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredEntry[]) : [];
  } catch {
    return [];
  }
}

function saveRegistryEntries(entries: StoredEntry[]): void {
  localStorage.setItem(STORAGE_KEYS.VAULT_REGISTRY, JSON.stringify(entries));
}

async function scanOpfsVaults(vaultsDir: FileSystemDirectoryHandle): Promise<StoredEntry[]> {
  const entries: StoredEntry[] = [];
  for await (const [dirName, handle] of vaultsDir.entries()) {
    if (handle.kind !== 'directory') continue;
    const dir = handle as FileSystemDirectoryHandle;
    const client = createOpfsClient(dir);
    try {
      const raw = await client.read(metaPath('manifest'));
      const manifest = ManifestSchema.parse(JSON.parse(raw));
      entries.push({
        projectId: manifest.project_id,
        name: manifest.name,
        sourceUrl: `localfs:///vaults/${manifest.project_id}`,
      });
    } catch {
      entries.push({
        projectId: dirName,
        name: dirName,
        sourceUrl: `localfs:///vaults/${dirName}`,
      });
    }
  }
  return entries;
}

function mergeEntries(existing: StoredEntry[], discovered: StoredEntry[]): StoredEntry[] {
  const byProjectId = new Map<string, StoredEntry>();
  for (const entry of existing) byProjectId.set(entry.projectId, entry);
  for (const entry of discovered) {
    if (!byProjectId.has(entry.projectId)) byProjectId.set(entry.projectId, entry);
  }
  return [...byProjectId.values()];
}
