import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createFileVolumeStore as createCoreFileVolumeStore,
  type FileVolumeStoreIo,
  type FsVolumeCredential,
  type FsVolumeCredentialStore,
  type VolumeCredentialEntry,
} from '@timenote/core';

const VOLUMES_FILENAME = 'volumes.json';

function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg || path.join(os.homedir(), '.config');
  return path.join(base, 'timenote');
}

function volumesPath(): string {
  return path.join(configDir(), VOLUMES_FILENAME);
}

const nodeIo: FileVolumeStoreIo = {
  async readFile(p: string): Promise<string | null> {
    try {
      return await fs.readFile(p, 'utf-8');
    } catch (e: any) {
      if (e?.code === 'ENOENT') return null;
      throw e;
    }
  },
  writeFile(p: string, content: string): Promise<void> {
    return fs
      .mkdir(path.dirname(p), { recursive: true })
      .then(() => fs.writeFile(p, content, 'utf-8'));
  },
  rename(from: string, to: string): Promise<void> {
    return fs.rename(from, to);
  },
  exists(p: string): Promise<boolean> {
    return fs.access(p).then(
      () => true,
      () => false,
    );
  },
};

/**
 * Load the shared file-backed volume store (~/.config/timenote/volumes.json).
 */
export async function loadVolumeStore(): Promise<FsVolumeCredentialStore> {
  const store = createCoreFileVolumeStore(nodeIo, volumesPath());
  await store.reload();
  return store;
}

export async function listVolumeCredentials(): Promise<VolumeCredentialEntry[]> {
  const store = await loadVolumeStore();
  return store.listVolumeCredentials() as VolumeCredentialEntry[];
}

export async function getVolumeCredential(
  volumeUrl: string,
): Promise<VolumeCredentialEntry | null> {
  const store = await loadVolumeStore();
  return store.getVolumeCredential(volumeUrl) as VolumeCredentialEntry | null;
}

export async function saveVolumeCredential(
  credential: FsVolumeCredential,
): Promise<VolumeCredentialEntry> {
  const store = await loadVolumeStore();
  return store.saveVolumeCredential(credential) as VolumeCredentialEntry;
}

export async function deleteVolumeCredential(volumeUrl: string): Promise<void> {
  const store = await loadVolumeStore();
  store.deleteVolumeCredential(volumeUrl);
}

/**
 * Resolve a `<volumeUrl>:<remotePath>` argument against configured volumes.
 * Uses longest-prefix matching so a more specific volumeUrl wins.
 */
export async function resolveVolumePath(
  volumePath: string,
): Promise<{ volume: VolumeCredentialEntry; remotePath: string }> {
  const credentials = await listVolumeCredentials();
  const sorted = [...credentials].sort((a, b) => b.volumeUrl.length - a.volumeUrl.length);
  for (const v of sorted) {
    const prefix = `${v.volumeUrl}:`;
    if (volumePath.startsWith(prefix)) {
      return { volume: v, remotePath: volumePath.slice(prefix.length) };
    }
  }
  throw new Error(
    `No matching volume for "${volumePath}". Available: ${credentials.map((a) => a.volumeUrl).join(', ') || '(none)'}`,
  );
}
