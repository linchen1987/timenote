import type { FsProviderAccount, FsProviderEntry, FsProviderIdentity } from '@timenote/core';
import { getProviderId } from '@timenote/core';

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

function toAccount(raw: RawEntry): FsProviderAccount | null {
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

function toIdentity(account: FsProviderAccount): FsProviderIdentity {
  switch (account.type) {
    case 's3':
      return { type: 's3', endpoint: account.endpoint, bucket: account.bucket };
    case 'webdav':
      return { type: 'webdav', host: account.host, username: account.username };
    default:
      throw new Error(`Unknown provider type: ${(account as { type: string }).type}`);
  }
}

export function normalizeLegacyEntry(
  raw: RawEntry,
): { entry: FsProviderEntry; oldId: string | null } | null {
  const flat = flattenNested(raw);
  const account = toAccount(flat);
  if (!account) return null;

  const newId = getProviderId(toIdentity(account));
  const oldId = typeof raw.id === 'string' && raw.id !== newId ? raw.id : null;

  return { entry: { ...account, id: newId }, oldId };
}
