import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  generateProviderId,
  type ProviderConfig,
  type ProviderEntry,
  type ProviderType,
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

async function readProviders(): Promise<ProviderEntry[]> {
  try {
    const raw = await fs.readFile(providersPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeProviders(providers: ProviderEntry[]): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(providersPath(), JSON.stringify(providers, null, 2));
}

export async function listProviders(): Promise<ProviderEntry[]> {
  return readProviders();
}

export async function getProvider(id: string): Promise<ProviderEntry | null> {
  const providers = await readProviders();
  return providers.find((p) => p.id === id) ?? null;
}

export async function resolveProviderPath(
  providerPath: string,
): Promise<{ provider: ProviderEntry; remotePath: string }> {
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
  options: ProviderConfig,
): Promise<ProviderEntry> {
  const id = generateProviderId(options);
  const entry: ProviderEntry = { ...options, id };
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
