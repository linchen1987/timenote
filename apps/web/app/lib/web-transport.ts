import { STORAGE_KEYS } from '@timenote/core';
import type { FsConnection } from './services/fs-client';

export type StorageType = 'webdav' | 's3';

const getStorageType = (): StorageType => {
  if (typeof window === 'undefined') return 'webdav';
  return (localStorage.getItem(STORAGE_KEYS.STORAGE_TYPE) as StorageType) || 'webdav';
};

export const setStorageType = (type: StorageType): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.STORAGE_TYPE, type);
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

export const webTransport = {
  async list(path: string) {
    const result = await callApi('list', path);
    return Array.isArray(result) ? result : [result];
  },

  async read(path: string): Promise<string> {
    const result = await callApi<string>('read', path);
    return result;
  },

  async write(path: string, content: string) {
    await callApi('write', path, { content });
  },

  async exists(path: string): Promise<boolean> {
    try {
      await callApi('stat', path);
      return true;
    } catch {
      return false;
    }
  },

  async ensureDir(path: string) {
    await callApi('ensureDir', path);
  },

  async remove(path: string) {
    await callApi('delete', path);
  },

  isConfigured(): boolean {
    return getFsConnection() !== null;
  },
};
