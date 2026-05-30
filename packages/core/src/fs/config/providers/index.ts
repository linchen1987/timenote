import type { FsTransport } from '../../transport';
import type { ProviderDef } from '../provider-def';
import { s3Def, type S3Identity, type S3Config, type S3TransportParams } from './s3';
import { webdavDef, type WebdavIdentity, type WebdavConfig, type WebdavTransportParams } from './webdav';

// ─── Re-export Provider Types ───────────────────────────────

export type { ProviderDef } from '../provider-def';
export type { S3Identity, S3Config, S3TransportParams } from './s3';
export type { WebdavIdentity, WebdavConfig, WebdavTransportParams } from './webdav';

// ─── Union Types ────────────────────────────────────────────

export type StorageProviderType = 's3' | 'webdav';
export type StorageProviderIdentity = S3Identity | WebdavIdentity;
export type StorageProviderConfig = S3Config | WebdavConfig;
export type TransportParams = S3TransportParams | WebdavTransportParams;

// ─── Provider Registry ──────────────────────────────────────

type AnyProviderDef = ProviderDef<{ type: string }, { type: string }>;

export const PROVIDER_DEFS: Record<StorageProviderType, AnyProviderDef> = {
  s3: s3Def as AnyProviderDef,
  webdav: webdavDef as AnyProviderDef,
};

const SCHEME_MAP = new Map<string, StorageProviderType>(
  (Object.entries(PROVIDER_DEFS) as [StorageProviderType, AnyProviderDef][]).map(
    ([type, def]) => [def.scheme, type],
  ),
);

// ─── Generic Functions ──────────────────────────────────────

export function generateProviderId(identity: StorageProviderIdentity): string {
  return PROVIDER_DEFS[identity.type].generateId(identity);
}

export function stringifySourceUrl(source: StorageProviderIdentity & { path: string }): string {
  const id = generateProviderId(source);
  return source.path ? `${id}/${source.path}` : id;
}

export function parseSourceUrl(url: string): StorageProviderIdentity & { path: string } {
  const protoIdx = url.indexOf('://');
  if (protoIdx < 0) throw new Error(`Invalid source URL: ${url}`);
  const scheme = url.slice(0, protoIdx);

  const type = SCHEME_MAP.get(scheme);
  if (!type) throw new Error(`Unsupported scheme: ${scheme}`);

  const rest = url.slice(protoIdx + 3);
  const lastAt = rest.lastIndexOf('@');
  if (lastAt < 0) throw new Error(`Missing identity in source URL: ${url}`);
  const userinfo = rest.slice(0, lastAt);
  const afterAt = rest.slice(lastAt + 1);
  const slashIdx = afterAt.indexOf('/');
  const host = slashIdx < 0 ? afterAt : afterAt.slice(0, slashIdx);
  const path = slashIdx < 0 ? '' : afterAt.slice(slashIdx + 1);

  return PROVIDER_DEFS[type].parseSource(userinfo, host, path);
}

export function createTransportFromConfig(config: StorageProviderConfig): FsTransport {
  return PROVIDER_DEFS[config.type].createTransport(config);
}

export function serializeTransportParams(config: StorageProviderConfig): Record<string, unknown> {
  return PROVIDER_DEFS[config.type].serializeParams(config);
}

export function createTransportFromParams(params: Record<string, unknown>): FsTransport {
  const type = params.type as StorageProviderType;
  return PROVIDER_DEFS[type].createTransportFromParams(params);
}
