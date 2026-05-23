import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  generateProviderId,
  type ProviderConfig,
  type ProviderType,
  type S3Provider,
  type WebdavProvider,
} from '@timenote/core';

function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg || path.join(os.homedir(), '.config');
  return path.join(base, 'timenote');
}

function providersPath(): string {
  return path.join(configDir(), 'providers.json');
}

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(configDir(), { recursive: true });
}

async function readProviders(): Promise<ProviderConfig[]> {
  try {
    const raw = await fs.readFile(providersPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeProviders(providers: ProviderConfig[]): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(providersPath(), JSON.stringify(providers, null, 2));
}

export async function listProviders(): Promise<ProviderConfig[]> {
  return readProviders();
}

export async function getProvider(id: string): Promise<ProviderConfig | null> {
  const providers = await readProviders();
  return providers.find((p) => p.id === id) ?? null;
}

export async function resolveProviderPath(
  providerPath: string,
): Promise<{ provider: ProviderConfig; remotePath: string }> {
  const providers = await readProviders();
  const sorted = [...providers].sort((a, b) => b.id.length - a.id.length);
  for (const p of sorted) {
    const prefix = p.id + ':';
    if (providerPath.startsWith(prefix)) {
      return { provider: p, remotePath: providerPath.slice(prefix.length) };
    }
  }
  throw new Error(
    `No matching provider for "${providerPath}". Available: ${providers.map((p) => p.id).join(', ') || '(none)'}`,
  );
}

export async function saveProvider(
  type: ProviderType,
  options: {
    webdav?: { url: string; username: string; password: string };
    s3?: {
      bucket: string;
      endpoint?: string;
      accessKeyId: string;
      secretAccessKey: string;
      region?: string;
    };
  },
): Promise<ProviderConfig> {
  const config: Omit<ProviderConfig, 'id'> & { id?: string } = { type };

  if (type === 'webdav' && options.webdav) {
    config.webdav = options.webdav;
  } else if (type === 's3' && options.s3) {
    config.s3 = options.s3;
  } else {
    throw new Error(`Missing configuration for provider type: ${type}`);
  }

  const id = generateProviderId(config);
  const entry: ProviderConfig = { ...config, id };
  const providers = await readProviders();
  const idx = providers.findIndex((p) => p.id === id);
  if (idx >= 0) {
    providers[idx] = entry;
  } else {
    providers.push(entry);
  }
  await writeProviders(providers);
  return entry;
}

export async function deleteProvider(id: string): Promise<void> {
  const providers = (await readProviders()).filter((p) => p.id !== id);
  await writeProviders(providers);
}
