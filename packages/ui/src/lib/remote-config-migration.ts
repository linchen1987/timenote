import { type FsProvider, META_DIR, type RemoteConfig, STORAGE_KEYS } from '@timenote/core';

const V1_KEY = '@timenote/notebook_remotes_migrated';
const V2_KEY = STORAGE_KEYS.NOTEBOOK_REMOTES_MIGRATED_V2;
const OLD_DATA_KEY = STORAGE_KEYS.NOTEBOOK_REMOTES;
const CLEANUP_DELAY_MS = 24 * 60 * 60 * 1000;

interface OldRemoteEntry {
  providerId: string;
  path: string;
  enabled: boolean;
}

type OldNotebookRemoteConfig = Record<string, Record<string, OldRemoteEntry>>;

function normalizeLegacyProviderId(id: string): string {
  if (/^(webdav|s3):\/\//.test(id)) return id;

  const m1 = id.match(/^webdav:([^@]+)@https?:\/\/(.+)$/);
  if (m1) return `webdav://${m1[1]}@${m1[2]}`;

  const m2 = id.match(/^s3:([^@]+)@(.+)$/);
  if (m2) return `s3://${m2[1]}@${m2[2]}`;

  return id;
}

function convertEntry(_name: string, entry: OldRemoteEntry): RemoteConfig | null {
  if (!entry.providerId) return null;

  const providerId = normalizeLegacyProviderId(entry.providerId);
  const url = entry.path ? `${providerId}/${entry.path}` : providerId;

  return {
    url,
    name: _name,
    default: entry.enabled === true,
  };
}

function parseTimestamp(value: string): number | null {
  const match = value.match(/^2:(\d+)$/);
  return match ? Number(match[1]) : null;
}

export async function migrateRemotesFromLocalStorage(
  getVaultProvider: (projectId: string) => Promise<FsProvider>,
  listVaultProjectIds: () => Promise<string[]>,
): Promise<void> {
  const state = localStorage.getItem(V2_KEY);

  // State '3': terminal, all done
  if (state === '3') return;

  // State '2:timestamp'
  if (state !== null) {
    const ts = parseTimestamp(state);
    if (ts !== null) {
      if (Date.now() - ts > CLEANUP_DELAY_MS) {
        localStorage.removeItem(OLD_DATA_KEY);
        localStorage.setItem(V2_KEY, '3');
      }
      return;
    }

    // Dirty data '2' (no timestamp): backfill
    if (state === '2') {
      localStorage.setItem(V2_KEY, '2:' + Date.now());
      return;
    }
  }

  // V2 is null — backward compat with V1 key
  if (state === null) {
    const v1 = localStorage.getItem(V1_KEY);
    if (v1 === '2') {
      localStorage.setItem(V2_KEY, '2:' + Date.now());
      return;
    }
  }

  // Execute migration
  const raw = localStorage.getItem(OLD_DATA_KEY);
  if (!raw) {
    localStorage.setItem(V2_KEY, '2:' + Date.now());
    return;
  }

  let oldConfig: OldNotebookRemoteConfig;
  try {
    oldConfig = JSON.parse(raw);
  } catch {
    localStorage.setItem(V2_KEY, '2:' + Date.now());
    return;
  }

  const existingProjectIds = new Set(await listVaultProjectIds());

  let allSucceeded = true;

  for (const [projectId, remotes] of Object.entries(oldConfig)) {
    if (!existingProjectIds.has(projectId)) continue;

    let transport: FsProvider;
    try {
      transport = await getVaultProvider(projectId);
    } catch {
      console.warn(`[migrateRemotes] vault transport not found for ${projectId}, skipping`);
      allSucceeded = false;
      continue;
    }

    let configLocalExists = false;
    try {
      const existing = await transport.read(`${META_DIR}/config.local.json`);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed.remotes?.length > 0) configLocalExists = true;
      }
    } catch {
      // file does not exist, proceed with migration
    }
    if (configLocalExists) continue;

    const newRemotes: RemoteConfig[] = [];
    for (const [name, entry] of Object.entries(remotes)) {
      const converted = convertEntry(name, entry);
      if (converted) newRemotes.push(converted);
    }

    if (newRemotes.length === 0) continue;

    try {
      await transport.ensureDir(META_DIR);
      await transport.write(
        `${META_DIR}/config.local.json`,
        JSON.stringify({ remotes: newRemotes }, null, 2),
      );
    } catch (e) {
      console.error(`[migrateRemotes] failed to write config.local.json for ${projectId}`, e);
      allSucceeded = false;
    }
  }

  if (allSucceeded) {
    localStorage.setItem(V2_KEY, '2:' + Date.now());
  }
}
