import { createWebdavTransport } from '../../webdav';
import type { ProviderDef } from '../provider-def';

export type WebdavIdentity = { type: 'webdav'; host: string; username: string };

export type WebdavConfig = WebdavIdentity & {
  password?: string;
  token?: string;
  tls?: boolean;
  port?: number;
};

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
};
