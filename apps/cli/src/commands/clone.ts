import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  createEmptyDeleteLog,
  createEmptySyncLedger,
  createManifest,
  createMenuData,
  META_DIR,
  metaPath,
} from '@timenote/core';
import type { Command } from 'commander';
import * as configStore from '../lib/config-store.js';
import { createNodeFsTransport } from '../lib/node-fs-transport.js';
import {
  createRemoteTransport,
  createSyncService,
  readManifest,
  writeRemotes,
} from '../lib/vault.js';

export function registerCloneCommand(program: Command) {
  program
    .command('clone')
    .description('Clone a notebook from remote to local directory')
    .argument(
      '<provider-path>',
      'providerId:remotePath (e.g. "webdav:user@url:timenote/vaults/vX")',
    )
    .argument('[dir]', 'Local directory name (defaults to notebook name)')
    .action(async (providerPath: string, dir?: string) => {
      let provider, remotePath;
      try {
        ({ provider, remotePath } = await configStore.resolveProviderPath(providerPath));
      } catch (e: any) {
        console.error(e.message);
        process.exit(1);
      }

      const remote = createRemoteTransport(provider, remotePath);

      let manifest;
      try {
        const raw = await remote.read(metaPath('manifest'));
        manifest = JSON.parse(raw);
      } catch {
        console.error('Remote vault manifest not found.');
        process.exit(1);
      }

      const localDir = dir || manifest.name || manifest.project_id;
      const vaultDir = path.resolve(localDir);

      await initVaultDir(vaultDir, manifest.project_id, manifest.name);

      writeRemotes(vaultDir, {
        origin: { providerId: provider.id, path: remotePath, enabled: true },
      });

      const sync = createSyncService(vaultDir);
      const sourceFs = toVaultFsFromRemote(remote);
      const result = await sync.initFromSource(sourceFs);

      console.log(`Cloned to ${localDir}/ (${manifest.name})`);
      if (result.pulled > 0) {
        console.log(`  Pulled ${result.pulled} file(s).`);
      }
      if (result.errors.length > 0) {
        for (const e of result.errors) {
          console.error(`  Error: ${e}`);
        }
      }
    });
}

async function initVaultDir(vaultDir: string, projectId: string, name: string): Promise<void> {
  const transport = createNodeFsTransport(vaultDir);
  const now = new Date().toISOString();

  await transport.ensureDir(META_DIR);

  const manifest = createManifest({
    project_id: projectId,
    name,
    created_at: now,
    updated_at: now,
  });

  await transport.write(metaPath('manifest'), JSON.stringify(manifest, null, 2));
  await transport.write(metaPath('menu'), JSON.stringify(createMenuData([], now), null, 2));
  await transport.write(metaPath('deleteLog'), JSON.stringify(createEmptyDeleteLog(now), null, 2));
  await transport.write(metaPath('syncLedger'), JSON.stringify(createEmptySyncLedger(), null, 2));
}

function toVaultFsFromRemote(remote: ReturnType<typeof createRemoteTransport>) {
  return {
    read: (p: string) => remote.read(p),
    write: (p: string, c: string) => remote.write(p, c),
    readBinary: (p: string) => remote.readBinary(p),
    writeBinary: (p: string, d: ArrayBuffer) => remote.writeBinary(p, d),
    remove: (p: string) => remote.remove(p),
    list: (p: string) => remote.list(p),
    exists: (p: string) => remote.exists(p),
    ensureDir: (p: string) => remote.ensureDir(p),
  };
}
