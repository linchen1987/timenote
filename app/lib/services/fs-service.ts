import { STORAGE_KEYS } from '~/lib/constants';
import type { FsConnection } from '~/services/fs-client';

export type StorageType = 'webdav' | 's3';

export const setStorageType = (type: StorageType): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.STORAGE_TYPE, type);
};

const getStorageType = (): StorageType => {
  if (typeof window === 'undefined') return 'webdav';
  return (localStorage.getItem(STORAGE_KEYS.STORAGE_TYPE) as StorageType) || 'webdav';
};

const getWebDAVConfig = (): { url: string; username?: string; password?: string } | null => {
  if (typeof window === 'undefined') return null;
  const url = localStorage.getItem(STORAGE_KEYS.WEBDAV_URL);
  if (!url) return null;
  return {
    url,
    username: localStorage.getItem(STORAGE_KEYS.WEBDAV_USERNAME) || '',
    password: localStorage.getItem(STORAGE_KEYS.WEBDAV_PASSWORD) || '',
  };
};

const getS3Config = (): {
  bucket: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
} | null => {
  if (typeof window === 'undefined') return null;
  const bucket = localStorage.getItem(STORAGE_KEYS.S3_BUCKET);
  const accessKeyId = localStorage.getItem(STORAGE_KEYS.S3_ACCESS_KEY_ID);
  const secretAccessKey = localStorage.getItem(STORAGE_KEYS.S3_SECRET_ACCESS_KEY);
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    endpoint: localStorage.getItem(STORAGE_KEYS.S3_ENDPOINT) || undefined,
    accessKeyId,
    secretAccessKey,
    region: localStorage.getItem(STORAGE_KEYS.S3_REGION) || undefined,
  };
};

const getFsConnection = (): FsConnection | null => {
  const storageType = getStorageType();
  if (storageType === 's3') {
    const s3Config = getS3Config();
    if (!s3Config) return null;
    return { type: 's3', ...s3Config };
  }
  const webdavConfig = getWebDAVConfig();
  if (!webdavConfig) return null;
  return { type: 'webdav', ...webdavConfig };
};

const isFsConfigured = (): boolean => {
  return getFsConnection() !== null;
};

const existingDirs = new Set<string>();

const callApi = async <T = unknown>(method: string, path: string, args?: unknown): Promise<T> => {
  const connection = getFsConnection();
  if (!connection) throw new Error('Storage not configured');

  const res = await fetch('/api/fs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connection, method, path, args }),
  });

  const data = (await res.json()) as { error?: string; result?: T };
  if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
  return data.result as T;
};

export const FsService = {
  isConfigured: isFsConfigured,
  setStorageType,

  async list(path: string) {
    const result = await callApi('list', path);
    return Array.isArray(result) ? result : [result];
  },

  async read(path: string): Promise<string> {
    const result = await callApi<string>('read', path);
    existingDirs.add(path.split('/').slice(0, -1).join('/') || '/');
    return result;
  },

  async write(path: string, content: string) {
    await callApi('write', path, { content });
    existingDirs.add(path.split('/').slice(0, -1).join('/') || '/');
  },

  async exists(path: string): Promise<boolean> {
    if (existingDirs.has(path)) return true;
    try {
      await callApi('stat', path);
      existingDirs.add(path);
      return true;
    } catch {
      return false;
    }
  },

  async ensureDir(path: string) {
    const parts = path.split('/').filter(Boolean);
    let current = '';
    let needsEnsure = false;

    for (const part of parts) {
      current += `/${part}`;
      if (!existingDirs.has(current)) {
        needsEnsure = true;
        break;
      }
    }

    if (!needsEnsure) return;

    await callApi('ensureDir', path);

    current = '';
    for (const part of parts) {
      current += `/${part}`;
      existingDirs.add(current);
    }
  },

  clearCache() {
    existingDirs.clear();
  },
};
