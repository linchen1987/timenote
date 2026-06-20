import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  createFsClient,
  createRemoteConfigService,
  createVaultSyncService,
  type FsClient,
  type FsVolumeCredentialStore,
  type Manifest,
  ManifestSchema,
  type RemoteConfigService,
  type SyncResult,
} from '@timenote/core';

const META_DIR = '.timenote';

export function readManifest(vaultDir: string): Manifest {
  const raw = readFileSync(path.join(vaultDir, META_DIR, 'manifest.json'), 'utf-8');
  return ManifestSchema.parse(JSON.parse(raw));
}

export function isVaultDir(dir: string): boolean {
  return existsSync(path.join(dir, META_DIR, 'manifest.json'));
}

export function resolveVaultDir(explicit?: string): string {
  if (explicit) {
    if (!isVaultDir(explicit)) {
      throw new Error(`Not a timenote vault: ${explicit}`);
    }
    return explicit;
  }

  let current = process.cwd();
  for (;;) {
    if (isVaultDir(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error('Not a timenote vault (or any parent). Use --dir to specify a vault directory.');
}

export function createRemoteProviderFromUrl(url: string, store: FsVolumeCredentialStore): FsClient {
  return createFsClient(url, { store });
}

export function createRemoteConfigServiceForVault(vaultDir: string): RemoteConfigService {
  const transport = createFsClient({ scheme: 'localfs', rootPath: vaultDir });
  return createRemoteConfigService(() => transport);
}

export function buildRemoteUrl(volumeUrl: string, remotePath: string): string {
  if (remotePath) {
    return `${volumeUrl}/${remotePath}`;
  }
  return volumeUrl;
}

export function createSyncService(vaultDir: string) {
  const transport = createFsClient({ scheme: 'localfs', rootPath: vaultDir });

  const vaultServiceLike = {
    async getClient(_projectId: string) {
      return transport as any;
    },
  };

  const noteServiceLike = {
    async rebuildIndex() {},
  };

  const syncSvc = createVaultSyncService(vaultServiceLike as any, noteServiceLike as any);

  return {
    async sync(remote: FsClient): Promise<SyncResult> {
      const manifest = readManifest(vaultDir);
      return syncSvc.sync(manifest.project_id, remote);
    },
    async pull(remote: FsClient): Promise<SyncResult> {
      const manifest = readManifest(vaultDir);
      return syncSvc.pull(manifest.project_id, remote);
    },
    async push(remote: FsClient): Promise<SyncResult> {
      const manifest = readManifest(vaultDir);
      return syncSvc.push(manifest.project_id, remote);
    },
    async initFromSource(source: FsClient): Promise<SyncResult> {
      const manifest = readManifest(vaultDir);
      await syncSvc.loadLedgerFromVault(manifest.project_id);
      return syncSvc.initFromSource(manifest.project_id, source);
    },
  };
}
