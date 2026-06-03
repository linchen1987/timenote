import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeVolumeUrl, type FsVolumeAccess, type FsVolumeAccessStore } from '@timenote/core';

type VolumeAccessEntry = FsVolumeAccess & { volumeUrl: string };

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

async function readVolumeAccesses(): Promise<VolumeAccessEntry[]> {
  try {
    const raw = await fs.readFile(providersPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeVolumeAccesses(accesses: VolumeAccessEntry[]): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(providersPath(), JSON.stringify(accesses, null, 2));
}

export async function listVolumeAccesses(): Promise<VolumeAccessEntry[]> {
  return readVolumeAccesses();
}

export async function getVolumeAccess(volumeUrl: string): Promise<VolumeAccessEntry | null> {
  const accesses = await readVolumeAccesses();
  return accesses.find((a) => a.volumeUrl === volumeUrl) ?? null;
}

export async function resolveProviderPath(
  providerPath: string,
): Promise<{ provider: VolumeAccessEntry; remotePath: string }> {
  const accesses = await readVolumeAccesses();
  const sorted = [...accesses].sort((a, b) => b.volumeUrl.length - a.volumeUrl.length);
  for (const a of sorted) {
    const prefix = `${a.volumeUrl}:`;
    if (providerPath.startsWith(prefix)) {
      return { provider: a, remotePath: providerPath.slice(prefix.length) };
    }
  }
  throw new Error(
    `No matching provider for "${providerPath}". Available: ${accesses.map((a) => a.volumeUrl).join(', ') || '(none)'}`,
  );
}

export async function saveVolumeAccess(access: FsVolumeAccess): Promise<VolumeAccessEntry> {
  const volumeUrl = computeVolumeUrl(access);
  const entry: VolumeAccessEntry = { ...access, volumeUrl };
  const accesses = await readVolumeAccesses();
  const idx = accesses.findIndex((a) => a.volumeUrl === volumeUrl);
  if (idx >= 0) {
    accesses[idx] = entry;
  } else {
    accesses.push(entry);
  }
  await writeVolumeAccesses(accesses);
  return entry;
}

export async function deleteVolumeAccess(volumeUrl: string): Promise<void> {
  const accesses = (await readVolumeAccesses()).filter((a) => a.volumeUrl !== volumeUrl);
  await writeVolumeAccesses(accesses);
}

export async function createFileProviderStore(): Promise<FsVolumeAccessStore> {
  let cache = await readVolumeAccesses();

  return {
    listVolumeAccesses(): VolumeAccessEntry[] {
      return cache;
    },
    getVolumeAccess(volumeUrl: string): FsVolumeAccess | null {
      return cache.find((a) => a.volumeUrl === volumeUrl) ?? null;
    },
    saveVolumeAccess(access: FsVolumeAccess): VolumeAccessEntry {
      const entry: VolumeAccessEntry = { ...access, volumeUrl: computeVolumeUrl(access) };
      const idx = cache.findIndex((a) => a.volumeUrl === entry.volumeUrl);
      if (idx >= 0) {
        cache[idx] = entry;
      } else {
        cache.push(entry);
      }
      writeVolumeAccesses(cache).catch(() => {});
      return entry;
    },
    deleteVolumeAccess(volumeUrl: string): void {
      cache = cache.filter((a) => a.volumeUrl !== volumeUrl);
      writeVolumeAccesses(cache).catch(() => {});
    },
  };
}
