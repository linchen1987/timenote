import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  createFsClient,
  createPrefixedTransport,
  createVaultSyncService,
  type Manifest,
  ManifestSchema,
  type ProviderConfig,
  type RemoteEntry,
  type RemoteTransport,
  type SyncResult,
  toVaultFs,
  type VaultFs,
} from '@timenote/core';
import { createNodeFsTransport } from './node-fs-transport.js';

const META_DIR = '.timenote';

export interface VaultRemotes {
  [name: string]: RemoteEntry;
}

function remotesPath(vaultDir: string): string {
  return path.join(vaultDir, META_DIR, 'remotes.json');
}

export function readRemotes(vaultDir: string): VaultRemotes {
  try {
    const raw = readFileSync(remotesPath(vaultDir), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeRemotes(vaultDir: string, remotes: VaultRemotes): void {
  mkdirSync(path.join(vaultDir, META_DIR), { recursive: true });
  writeFileSync(remotesPath(vaultDir), JSON.stringify(remotes, null, 2));
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

export function createRemoteTransport(
  provider: ProviderConfig,
  remotePath: string,
): RemoteTransport {
  const client = createFsClient(providerToConnection(provider));
  return fsClientToRemoteTransport(client, remotePath);
}

function providerToConnection(provider: ProviderConfig) {
  if (provider.type === 'webdav' && provider.webdav) {
    return {
      type: 'webdav' as const,
      url: provider.webdav.url,
      username: provider.webdav.username,
      password: provider.webdav.password,
    };
  }
  if (provider.type === 's3' && provider.s3) {
    return {
      type: 's3' as const,
      bucket: provider.s3.bucket,
      endpoint: provider.s3.endpoint,
      accessKeyId: provider.s3.accessKeyId,
      secretAccessKey: provider.s3.secretAccessKey,
      region: provider.s3.region,
    };
  }
  throw new Error(`Invalid provider: ${provider.id}`);
}

function fsClientToRemoteTransport(
  client: ReturnType<typeof createFsClient>,
  prefix: string,
): RemoteTransport {
  const transport: RemoteTransport = {
    async list(p: string) {
      return client.readdir(p);
    },
    async read(p: string): Promise<string> {
      const buf = await client.readFile(p);
      return typeof buf === 'string' ? buf : new TextDecoder().decode(buf);
    },
    async write(p: string, content: string) {
      await client.writeFile(p, content);
    },
    async readBinary(p: string): Promise<ArrayBuffer> {
      const buf = await client.readFile(p);
      return typeof buf === 'string' ? (new TextEncoder().encode(buf).buffer as ArrayBuffer) : buf;
    },
    async writeBinary(p: string, data: ArrayBuffer) {
      await client.writeFile(p, data);
    },
    async remove(p: string) {
      await client.unlink(p);
    },
    async exists(p: string): Promise<boolean> {
      try {
        await client.stat(p);
        return true;
      } catch {
        return false;
      }
    },
    async ensureDir(p: string) {
      await client.ensureDir(p);
    },
    isConfigured(): boolean {
      return true;
    },
  };

  return createPrefixedTransport(prefix, transport);
}

export function createSyncService(vaultDir: string) {
  const transport = createNodeFsTransport(vaultDir);

  const vaultServiceLike = {
    getTransport(_projectId: string) {
      return transport as unknown as import('@timenote/core').OpfsTransport;
    },
  };

  const noteServiceLike = {
    async rebuildIndex() {},
  };

  const syncSvc = createVaultSyncService(vaultServiceLike as any, noteServiceLike as any);

  return {
    async sync(remote: RemoteTransport): Promise<SyncResult> {
      const manifest = readManifest(vaultDir);
      return syncSvc.sync(manifest.project_id, remote);
    },
    async pull(remote: RemoteTransport): Promise<SyncResult> {
      const manifest = readManifest(vaultDir);
      return syncSvc.pull(manifest.project_id, remote);
    },
    async initFromSource(source: VaultFs): Promise<SyncResult> {
      const manifest = readManifest(vaultDir);
      await syncSvc.loadLedgerCache(manifest.project_id);
      return syncSvc.initFromSource(manifest.project_id, source);
    },
  };
}
