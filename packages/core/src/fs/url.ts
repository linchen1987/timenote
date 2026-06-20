import { computeS3VolumeUrl, parseS3Url, resolveS3ConfigFromUrl } from './adapters/s3/s3';
import {
  computeWebdavVolumeUrl,
  parseWebdavUrl,
  resolveWebdavConfigFromUrl,
} from './adapters/webdav/webdav';
import type { FsClientConfig, FsScheme, FsVolumeCredentialStore } from './types';

export function resolveFsConfig(url: string, store?: FsVolumeCredentialStore): FsClientConfig {
  const scheme = extractScheme(url);
  if (scheme === 's3') return resolveS3ConfigFromUrl(url, store);
  if (scheme === 'webdav') return resolveWebdavConfigFromUrl(url, store);
  if (scheme === 'localfs') return { scheme: 'localfs', rootPath: '/' };
  throw new Error(`Unsupported scheme: ${scheme}`);
}

export function computeVolumeUrl(identity: Record<string, unknown>): string {
  const scheme = (identity as any).scheme as FsScheme;
  if (scheme === 's3') return computeS3VolumeUrl(identity as { bucket: string; endpoint: string });
  if (scheme === 'webdav')
    return computeWebdavVolumeUrl(identity as { username: string; host: string });
  if (scheme === 'localfs') return 'localfs://';
  throw new Error(`Unsupported scheme: ${scheme}`);
}

export function parseVolumeUrl(url: string): Record<string, unknown> {
  const scheme = extractScheme(url);
  if (scheme === 's3') return parseS3Url(url);
  if (scheme === 'webdav') return parseWebdavUrl(url);
  throw new Error(`Unsupported scheme: ${scheme}`);
}

export function extractScheme(url: string): FsScheme {
  const protoIdx = url.indexOf('://');
  if (protoIdx < 0) throw new Error(`Invalid URL: ${url}`);
  return url.slice(0, protoIdx) as FsScheme;
}
