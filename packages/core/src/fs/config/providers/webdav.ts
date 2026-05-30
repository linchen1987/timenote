import { createWebdavTransport } from '../../webdav';
import type { ProviderDef } from '../provider-def';

// ─── WebDAV Types ───────────────────────────────────────────

export type WebdavIdentity = { type: 'webdav'; host: string; username: string };

export type WebdavConfig = WebdavIdentity & {
  password?: string;
  token?: string;
  tls?: boolean;
  port?: number;
};

export type WebdavTransportParams = {
  type: 'webdav';
  url: string;
  username: string;
  password: string;
};

// ─── WebDAV Provider Definition ─────────────────────────────

function buildUrl(config: WebdavConfig): string {
  const protocol = config.tls !== false ? 'https' : 'http';
  const defaultPort = config.tls !== false ? 443 : 80;
  return config.port && config.port !== defaultPort
    ? `${protocol}://${config.host}:${config.port}`
    : `${protocol}://${config.host}`;
}

export const webdavDef: ProviderDef<WebdavIdentity, WebdavConfig> = {
  scheme: 'webdav',

  generateId({ username, host }) {
    return `webdav://${username}@${host}`;
  },

  parseSource(userinfo, host, path) {
    return { type: 'webdav', username: userinfo, host, path };
  },

  createTransport(config) {
    const url = buildUrl(config);
    return createWebdavTransport(url, config.username, config.password);
  },

  serializeParams(config) {
    return {
      type: 'webdav',
      url: buildUrl(config),
      username: config.username,
      password: config.password || '',
    };
  },

  createTransportFromParams(params) {
    return createWebdavTransport(
      params.url as string,
      params.username as string,
      params.password as string | undefined,
    );
  },
};
