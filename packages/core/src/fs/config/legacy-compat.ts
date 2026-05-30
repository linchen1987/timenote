import type { StorageProviderConfig, StorageProviderIdentity } from './providers';
import { generateProviderId } from './providers';
import type { StorageProviderEntry } from './store';

type RawEntry = Record<string, unknown>;

function flattenNested(raw: RawEntry): RawEntry {
  if (raw.type === 's3' && raw.s3 && typeof raw.s3 === 'object') {
    const { s3, ...rest } = raw;
    return { ...rest, ...(s3 as Record<string, unknown>) };
  }
  if (raw.type === 'webdav' && raw.webdav && typeof raw.webdav === 'object') {
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

function toConfig(raw: RawEntry): StorageProviderConfig | null {
  if (raw.type === 's3') {
    if (typeof raw.endpoint !== 'string' || typeof raw.bucket !== 'string') return null;
    if (typeof raw.accessKeyId !== 'string' || typeof raw.secretAccessKey !== 'string') return null;
    return {
      type: 's3',
      endpoint: raw.endpoint,
      bucket: raw.bucket,
      accessKeyId: raw.accessKeyId,
      secretAccessKey: raw.secretAccessKey,
      region: typeof raw.region === 'string' ? raw.region : undefined,
    };
  }
  if (raw.type === 'webdav') {
    if (typeof raw.host !== 'string' || typeof raw.username !== 'string') return null;
    return {
      type: 'webdav',
      host: raw.host,
      username: raw.username,
      password: typeof raw.password === 'string' ? raw.password : undefined,
      tls: typeof raw.tls === 'boolean' ? raw.tls : undefined,
      port: typeof raw.port === 'number' ? raw.port : undefined,
    };
  }
  return null;
}

function toIdentity(config: StorageProviderConfig): StorageProviderIdentity {
  switch (config.type) {
    case 's3':
      return { type: 's3', endpoint: config.endpoint, bucket: config.bucket };
    case 'webdav':
      return { type: 'webdav', host: config.host, username: config.username };
  }
}

export interface NormalizedEntry {
  entry: StorageProviderEntry;
  oldId: string | null;
}

export function normalizeLegacyEntry(raw: RawEntry): NormalizedEntry | null {
  const flat = flattenNested(raw);
  const config = toConfig(flat);
  if (!config) return null;

  const newId = generateProviderId(toIdentity(config));
  const oldId = typeof raw.id === 'string' && raw.id !== newId ? raw.id : null;

  return { entry: { ...config, id: newId }, oldId };
}
