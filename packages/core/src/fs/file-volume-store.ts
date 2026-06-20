import type { FsVolume, FsVolumeCredential, FsVolumeCredentialStore } from './types';
import { computeVolumeUrl } from './url';

export type VolumeCredentialEntry = FsVolumeCredential & { volumeUrl: string };
type RawEntry = Record<string, unknown>;

/**
 * IO abstraction so the same file-backed volume store can run on Node (CLI)
 * and Tauri IPC (desktop). Each adapter injects its own primitives.
 */
export interface FileVolumeStoreIo {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

function flattenNested(raw: RawEntry): RawEntry {
  if (raw.scheme === 's3' && raw.s3 && typeof raw.s3 === 'object') {
    const { s3, ...rest } = raw;
    return { ...rest, ...(s3 as Record<string, unknown>) };
  }
  if (raw.scheme === 'webdav' && raw.webdav && typeof raw.webdav === 'object') {
    const { webdav, ...rest } = raw;
    const wd = webdav as Record<string, unknown>;
    const result: RawEntry = { ...rest };
    if (typeof wd.url === 'string') {
      result.host = wd.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      result.tls = wd.url.startsWith('https');
    }
    if (wd.username) result.username = wd.username;
    if (wd.password) result.password = wd.password;
    return result;
  }
  return raw;
}

function toAccount(raw: RawEntry): FsVolumeCredential | null {
  if (raw.scheme === 's3') {
    if (typeof raw.endpoint !== 'string' || typeof raw.bucket !== 'string') return null;
    if (typeof raw.accessKeyId !== 'string' || typeof raw.secretAccessKey !== 'string') return null;
    return {
      scheme: 's3',
      endpoint: raw.endpoint,
      bucket: raw.bucket,
      accessKeyId: raw.accessKeyId,
      secretAccessKey: raw.secretAccessKey,
      region: typeof raw.region === 'string' ? raw.region : undefined,
    };
  }
  if (raw.scheme === 'webdav') {
    if (typeof raw.host !== 'string' || typeof raw.username !== 'string') return null;
    return {
      scheme: 'webdav',
      host: raw.host,
      username: raw.username,
      password: typeof raw.password === 'string' ? raw.password : undefined,
      tls: typeof raw.tls === 'boolean' ? raw.tls : undefined,
      port: typeof raw.port === 'number' ? raw.port : undefined,
    };
  }
  return null;
}

function toIdentity(account: FsVolumeCredential): FsVolume {
  switch (account.scheme) {
    case 's3':
      return { scheme: 's3', endpoint: account.endpoint, bucket: account.bucket };
    case 'webdav':
      return { scheme: 'webdav', host: account.host, username: account.username };
    default:
      throw new Error(`Unknown volume scheme: ${(account as { scheme: string }).scheme}`);
  }
}

/**
 * Normalize a legacy/raw volume entry into a canonical credential.
 * Handles `type`→`scheme` migration and nested `{s3|webdav:{...}}` shapes.
 * Shared by the CLI file store, the desktop file store, and the browser
 * localStorage store so normalization lives in exactly one place.
 */
export function normalizeVolumeEntry(raw: RawEntry): VolumeCredentialEntry | null {
  const compat: RawEntry = !raw.scheme && raw.type ? { ...raw, scheme: raw.type } : raw;
  const flat = flattenNested(compat);
  const account = toAccount(flat);
  if (!account) return null;

  const volumeUrl = computeVolumeUrl(toIdentity(account));
  return { ...account, volumeUrl };
}

/** Parse a JSON document (array form) into normalized volume entries. */
export function parseVolumeEntries(raw: string | null): VolumeCredentialEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const result: VolumeCredentialEntry[] = [];
    for (const item of data) {
      if (item && typeof item === 'object') {
        const normalized = normalizeVolumeEntry(item as RawEntry);
        if (normalized) result.push(normalized);
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Create a file-backed FsVolumeCredentialStore. Callers MUST `await reload()`
 * once after construction (and before first query) to populate the cache.
 * Writes are atomic (temp file + rename) and fire-and-forget, mirroring the
 * FsVolumeCredentialStore synchronous contract.
 */
export function createFileVolumeStore(
  io: FileVolumeStoreIo,
  filePath: string,
): FsVolumeCredentialStore & {
  reload(): Promise<void>;
  flush(): Promise<void>;
} {
  let cache: VolumeCredentialEntry[] = [];

  async function persist(entries: VolumeCredentialEntry[]): Promise<void> {
    const tmp = `${filePath}.tmp`;
    await io.writeFile(tmp, JSON.stringify(entries, null, 2));
    await io.rename(tmp, filePath);
  }

  return {
    async reload(): Promise<void> {
      cache = parseVolumeEntries(await io.readFile(filePath));
    },

    async flush(): Promise<void> {
      await persist(cache);
    },

    listVolumeCredentials(): VolumeCredentialEntry[] {
      return cache;
    },

    getVolumeCredential(volumeUrl: string): FsVolumeCredential | null {
      return cache.find((e) => e.volumeUrl === volumeUrl) ?? null;
    },

    saveVolumeCredential(credential: FsVolumeCredential): VolumeCredentialEntry {
      const entry: VolumeCredentialEntry = {
        ...credential,
        volumeUrl: computeVolumeUrl(credential),
      };
      const idx = cache.findIndex((e) => e.volumeUrl === entry.volumeUrl);
      if (idx >= 0) cache[idx] = entry;
      else cache.push(entry);
      persist(cache).catch(() => {});
      return entry;
    },

    deleteVolumeCredential(volumeUrl: string): void {
      cache = cache.filter((e) => e.volumeUrl !== volumeUrl);
      persist(cache).catch(() => {});
    },
  };
}
