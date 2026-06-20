import {
  createFsClient,
  extractScheme,
  type FsClient,
  parseS3Url,
  parseWebdavUrl,
} from '@timenote/core';
import { loadVolumeStore } from './config-store.js';

export interface RemoteCredentialOptions {
  /** Remote vault URL, e.g. s3://bucket@endpoint/path or webdav://user@host/path. */
  remote?: string;
  /** S3 access key id (overrides URL-embedded / stored credentials). */
  accessKeyId?: string;
  /** S3 secret access key. */
  secretAccessKey?: string;
  /** S3 region. */
  region?: string;
  /** WebDAV password. */
  password?: string;
}

/**
 * Resolve the remote URL from --remote flag or TIMENOTE_REMOTE_URL env.
 * Throws if neither is provided.
 */
export function resolveRemoteUrl(opts: RemoteCredentialOptions): string {
  const url = opts.remote || process.env.TIMENOTE_REMOTE_URL;
  if (!url) {
    throw new Error('No remote specified. Use --remote <url> or set TIMENOTE_REMOTE_URL.');
  }
  return url;
}

/**
 * Build a remote FsClient with a 3-layer credential resolution:
 *   1. Explicit flags (secrets kept out of URLs / logs).
 *   2. Credentials embedded in the URL (self-contained connection string).
 *   3. File credential store (~/.config/timenote/volumes.json) by volumeUrl.
 */
export async function resolveRemoteClient(opts: RemoteCredentialOptions): Promise<FsClient> {
  const url = resolveRemoteUrl(opts);
  const scheme = extractScheme(url);

  if (scheme === 's3' && opts.accessKeyId && opts.secretAccessKey) {
    const endpoint = parseS3Url(stripQuery(url));
    return createFsClient({
      scheme: 's3',
      bucket: endpoint.bucket,
      endpoint: endpoint.endpoint,
      rootPath: endpoint.rootPath,
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
      region: opts.region,
    });
  }

  if (scheme === 'webdav' && opts.password !== undefined) {
    const endpoint = parseWebdavUrl(stripWebdavPassword(url));
    return createFsClient({
      scheme: 'webdav',
      host: endpoint.host,
      username: endpoint.username,
      password: opts.password,
      rootPath: endpoint.rootPath,
    });
  }

  // Embedded creds in URL (handled by resolveFsConfig) or file-store fallback.
  const store = await loadVolumeStore();
  return createFsClient(url, { store });
}

function stripQuery(url: string): string {
  const idx = url.indexOf('?');
  return idx >= 0 ? url.slice(0, idx) : url;
}

/** Drop `:password` from `user:password@` so parseWebdavUrl only sees `user@`. */
function stripWebdavPassword(url: string): string {
  const protoIdx = url.indexOf('://');
  if (protoIdx < 0) return url;
  const rest = url.slice(protoIdx + 3);
  const lastAt = rest.lastIndexOf('@');
  if (lastAt < 0) return url;
  const userinfo = rest.slice(0, lastAt);
  const colonIdx = userinfo.indexOf(':');
  if (colonIdx < 0) return url;
  return `${url.slice(0, protoIdx)}://${userinfo.slice(0, colonIdx)}@${rest.slice(lastAt + 1)}`;
}
