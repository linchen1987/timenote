import type { FsVolume, FsVolumeCredential } from '@timenote/core';
import { computeVolumeUrl } from '@timenote/core';

type VolumeCredentialEntry = FsVolumeCredential & { volumeUrl: string };
type RawEntry = Record<string, unknown>;

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
      throw new Error(`Unknown provider scheme: ${(account as { scheme: string }).scheme}`);
  }
}

export function normalizeLegacyEntry(
  raw: RawEntry,
): { entry: VolumeCredentialEntry; oldId: string | null } | null {
  const compat: RawEntry = !raw.scheme && raw.type ? { ...raw, scheme: raw.type } : raw;
  const flat = flattenNested(compat);
  const account = toAccount(flat);
  if (!account) return null;

  const newId = computeVolumeUrl(toIdentity(account));
  const oldId = typeof raw.id === 'string' && raw.id !== newId ? raw.id : null;

  return { entry: { ...account, volumeUrl: newId }, oldId };
}
