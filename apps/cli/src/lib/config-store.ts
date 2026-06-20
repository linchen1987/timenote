import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  computeVolumeUrl,
  type FsVolumeCredential,
  type FsVolumeCredentialStore,
} from '@timenote/core';

type VolumeCredentialEntry = FsVolumeCredential & { volumeUrl: string };

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

async function readVolumeCredentials(): Promise<VolumeCredentialEntry[]> {
  try {
    const raw = await fs.readFile(providersPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeVolumeCredentials(credentials: VolumeCredentialEntry[]): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(providersPath(), JSON.stringify(credentials, null, 2));
}

export async function listVolumeCredentials(): Promise<VolumeCredentialEntry[]> {
  return readVolumeCredentials();
}

export async function getVolumeCredential(
  volumeUrl: string,
): Promise<VolumeCredentialEntry | null> {
  const credentials = await readVolumeCredentials();
  return credentials.find((a) => a.volumeUrl === volumeUrl) ?? null;
}

export async function resolveProviderPath(
  providerPath: string,
): Promise<{ provider: VolumeCredentialEntry; remotePath: string }> {
  const credentials = await readVolumeCredentials();
  const sorted = [...credentials].sort((a, b) => b.volumeUrl.length - a.volumeUrl.length);
  for (const a of sorted) {
    const prefix = `${a.volumeUrl}:`;
    if (providerPath.startsWith(prefix)) {
      return { provider: a, remotePath: providerPath.slice(prefix.length) };
    }
  }
  throw new Error(
    `No matching provider for "${providerPath}". Available: ${credentials.map((a) => a.volumeUrl).join(', ') || '(none)'}`,
  );
}

export async function saveVolumeCredential(
  credential: FsVolumeCredential,
): Promise<VolumeCredentialEntry> {
  const volumeUrl = computeVolumeUrl(credential);
  const entry: VolumeCredentialEntry = { ...credential, volumeUrl };
  const credentials = await readVolumeCredentials();
  const idx = credentials.findIndex((a) => a.volumeUrl === volumeUrl);
  if (idx >= 0) {
    credentials[idx] = entry;
  } else {
    credentials.push(entry);
  }
  await writeVolumeCredentials(credentials);
  return entry;
}

export async function deleteVolumeCredential(volumeUrl: string): Promise<void> {
  const credentials = (await readVolumeCredentials()).filter((a) => a.volumeUrl !== volumeUrl);
  await writeVolumeCredentials(credentials);
}

export async function createFileProviderStore(): Promise<FsVolumeCredentialStore> {
  let cache = await readVolumeCredentials();

  return {
    listVolumeCredentials(): VolumeCredentialEntry[] {
      return cache;
    },
    getVolumeCredential(volumeUrl: string): FsVolumeCredential | null {
      return cache.find((a) => a.volumeUrl === volumeUrl) ?? null;
    },
    saveVolumeCredential(credential: FsVolumeCredential): VolumeCredentialEntry {
      const entry: VolumeCredentialEntry = {
        ...credential,
        volumeUrl: computeVolumeUrl(credential),
      };
      const idx = cache.findIndex((a) => a.volumeUrl === entry.volumeUrl);
      if (idx >= 0) {
        cache[idx] = entry;
      } else {
        cache.push(entry);
      }
      writeVolumeCredentials(cache).catch(() => {});
      return entry;
    },
    deleteVolumeCredential(volumeUrl: string): void {
      cache = cache.filter((a) => a.volumeUrl !== volumeUrl);
      writeVolumeCredentials(cache).catch(() => {});
    },
  };
}
