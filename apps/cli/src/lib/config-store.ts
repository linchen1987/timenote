import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  type FsProviderAccount,
  type FsProviderEntry,
  type FsProviderStore,
  type FsProviderType,
  getProviderId,
  toProviderEntry,
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

async function readProviders(): Promise<FsProviderEntry[]> {
  try {
    const raw = await fs.readFile(providersPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeProviders(providers: FsProviderEntry[]): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(providersPath(), JSON.stringify(providers, null, 2));
}

export async function listProviders(): Promise<FsProviderEntry[]> {
  return readProviders();
}

export async function getProvider(id: string): Promise<FsProviderEntry | null> {
  const providers = await readProviders();
  return providers.find((p) => p.id === id) ?? null;
}

export async function resolveProviderPath(
  providerPath: string,
): Promise<{ provider: FsProviderEntry; remotePath: string }> {
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
  type: FsProviderType,
  options: FsProviderAccount,
): Promise<FsProviderEntry> {
  const id = getProviderId(options);
  const entry: FsProviderEntry = { ...options, id };
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

export async function createFileProviderStore(): Promise<FsProviderStore> {
  let cache = await readProviders();

  return {
    listProviders(): FsProviderEntry[] {
      return cache;
    },
    getProvider(id: string): FsProviderAccount | null {
      return cache.find((p) => p.id === id) ?? null;
    },
    saveProvider(account: FsProviderAccount): FsProviderEntry {
      const entry = toProviderEntry(account);
      const idx = cache.findIndex((p) => p.id === entry.id);
      if (idx >= 0) {
        cache[idx] = entry;
      } else {
        cache.push(entry);
      }
      writeProviders(cache).catch(() => {});
      return entry;
    },
    deleteProvider(id: string): void {
      cache = cache.filter((p) => p.id !== id);
      writeProviders(cache).catch(() => {});
    },
  };
}
