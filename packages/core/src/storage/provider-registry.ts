import { STORAGE_KEYS } from '../constants';

export type ProviderType = 'webdav' | 's3';

export interface WebdavProvider {
  url: string;
  username: string;
  password: string;
}

export interface S3Provider {
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  webdav?: WebdavProvider;
  s3?: S3Provider;
}

export function generateProviderId(config: Omit<ProviderConfig, 'id'>): string {
  if (config.type === 'webdav' && config.webdav) {
    const url = config.webdav.url.replace(/\/+$/, '');
    return `webdav:${config.webdav.username}@${url}`;
  }
  if (config.type === 's3' && config.s3) {
    return `s3:${config.s3.bucket}@${config.s3.endpoint ?? ''}`;
  }
  throw new Error('Invalid provider config');
}

function readProviders(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROVIDERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeProviders(providers: ProviderConfig[]): void {
  localStorage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(providers));
}

export function listProviders(): ProviderConfig[] {
  return readProviders();
}

export function getProvider(id: string): ProviderConfig | null {
  return readProviders().find((p) => p.id === id) ?? null;
}

export function saveProvider(config: Omit<ProviderConfig, 'id'> & { id?: string }): ProviderConfig {
  const id = config.id ?? generateProviderId(config);
  const providers = readProviders();
  const entry: ProviderConfig = { ...config, id };
  const idx = providers.findIndex((p) => p.id === id);
  if (idx >= 0) {
    providers[idx] = entry;
  } else {
    providers.push(entry);
  }
  writeProviders(providers);
  return entry;
}

export function deleteProvider(id: string): void {
  const providers = readProviders().filter((p) => p.id !== id);
  writeProviders(providers);
}
