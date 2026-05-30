import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  type ConfigLocal,
  ConfigLocalSchema,
  createPrefixedTransport,
  createTransportFromConfig,
  createVaultSyncService,
  type FsTransport,
  type Manifest,
  ManifestSchema,
  type StorageProviderEntry as ProviderEntry,
  type SyncResult,
} from '@timenote/core';
import { createNodeFsTransport } from '@timenote/core/fs/node-fs';

const META_DIR = '.timenote';

function configLocalPath(vaultDir: string): string {
  return path.join(vaultDir, META_DIR, 'config.local.json');
}

export function readRemotes(vaultDir: string): ConfigLocal {
  try {
    const raw = readFileSync(configLocalPath(vaultDir), 'utf-8');
    return ConfigLocalSchema.parse(JSON.parse(raw));
  } catch {
    return { remotes: [] };
  }
}

export function writeRemotes(vaultDir: string, config: ConfigLocal): void {
  mkdirSync(path.join(vaultDir, META_DIR), { recursive: true });
  writeFileSync(configLocalPath(vaultDir), JSON.stringify(config, null, 2));
}

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

export function createRemoteTransport(provider: ProviderEntry, remotePath: string): FsTransport {
  const config = provider as unknown as import('@timenote/core').StorageProviderConfig;
  const base = createTransportFromConfig(config);
  return createPrefixedTransport(remotePath, base);
}

export function createSyncService(vaultDir: string) {
  const transport = createNodeFsTransport(vaultDir);

  const vaultServiceLike = {
    getTransport(_projectId: string) {
      return transport as any;
    },
  };

  const noteServiceLike = {
    async rebuildIndex() {},
  };

  const syncSvc = createVaultSyncService(vaultServiceLike as any, noteServiceLike as any);

  return {
    async sync(remote: FsTransport): Promise<SyncResult> {
      const manifest = readManifest(vaultDir);
      return syncSvc.sync(manifest.project_id, remote);
    },
    async pull(remote: FsTransport): Promise<SyncResult> {
      const manifest = readManifest(vaultDir);
      return syncSvc.pull(manifest.project_id, remote);
    },
    async push(remote: FsTransport): Promise<SyncResult> {
      const manifest = readManifest(vaultDir);
      return syncSvc.push(manifest.project_id, remote);
    },
    async initFromSource(source: FsTransport): Promise<SyncResult> {
      const manifest = readManifest(vaultDir);
      await syncSvc.loadLedgerCache(manifest.project_id);
      return syncSvc.initFromSource(manifest.project_id, source);
    },
  };
}
