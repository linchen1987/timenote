import { STORAGE_KEYS } from '~/lib/constants';

export interface WebDAVConfig {
  url: string;
  username?: string;
  password?: string;
}

const getConfig = (): WebDAVConfig | null => {
  if (typeof window === 'undefined') return null;
  const url = localStorage.getItem(STORAGE_KEYS.WEBDAV_URL);
  if (!url) return null;
  return {
    url,
    username: localStorage.getItem(STORAGE_KEYS.WEBDAV_USERNAME) || '',
    password: localStorage.getItem(STORAGE_KEYS.WEBDAV_PASSWORD) || '',
  };
};

const callApi = async <T = unknown>(method: string, path: string, args?: unknown): Promise<T> => {
  const config = getConfig();
  if (!config) throw new Error('WebDAV not configured');

  const res = await fetch('/api/fs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      connection: { type: 'webdav', ...config },
      method,
      path,
      args,
    }),
  });

  const data = (await res.json()) as { error?: string; result?: T };
  if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
  return data.result as T;
};

export const WebDAVService = {
  async list(path: string) {
    const result = await callApi('list', path);
    return Array.isArray(result) ? result : [result];
  },

  async read(path: string): Promise<string> {
    return await callApi('read', path);
  },

  async write(path: string, content: string) {
    return await callApi('write', path, { content });
  },

  async delete(path: string) {
    return await callApi('delete', path);
  },

  async mkdir(path: string) {
    return await callApi('mkdir', path);
  },

  async exists(path: string): Promise<boolean> {
    try {
      await callApi('stat', path);
      return true;
    } catch (_e) {
      return false;
    }
  },

  async ensureDir(path: string) {
    const parts = path.split('/').filter((p) => p);
    let current = '';
    for (const part of parts) {
      current += `/${part}`;
      if (!(await this.exists(current))) {
        await this.mkdir(current);
      }
    }
  },
};
