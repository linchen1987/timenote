import { STORAGE_KEYS } from '~/lib/constants';

export interface WebDAVConfig {
  url: string;
  username?: string;
  password?: string;
}

export class WebDAVService {
  private static getConfig(): WebDAVConfig | null {
    if (typeof window === 'undefined') return null;
    const url = localStorage.getItem(STORAGE_KEYS.WEBDAV_URL);
    if (!url) return null;
    return {
      url,
      username: localStorage.getItem(STORAGE_KEYS.WEBDAV_USERNAME) || '',
      password: localStorage.getItem(STORAGE_KEYS.WEBDAV_PASSWORD) || '',
    };
  }

  private static async callApi(method: string, path: string, args?: any) {
    const config = WebDAVService.getConfig();
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

    const data = (await res.json()) as { error?: string; result?: any };
    if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
    return data.result;
  }

  static async list(path: string) {
    const result = await WebDAVService.callApi('list', path);
    return Array.isArray(result) ? result : [result];
  }

  static async read(path: string): Promise<string> {
    return await WebDAVService.callApi('read', path);
  }

  static async write(path: string, content: string) {
    return await WebDAVService.callApi('write', path, { content });
  }

  static async delete(path: string) {
    return await WebDAVService.callApi('delete', path);
  }

  static async mkdir(path: string) {
    return await WebDAVService.callApi('mkdir', path);
  }

  static async exists(path: string): Promise<boolean> {
    try {
      await WebDAVService.callApi('stat', path);
      return true;
    } catch (_e) {
      return false;
    }
  }

  static async ensureDir(path: string) {
    const parts = path.split('/').filter((p) => p);
    let current = '';
    for (const part of parts) {
      current += `/${part}`;
      if (!(await WebDAVService.exists(current))) {
        await WebDAVService.mkdir(current);
      }
    }
  }
}
