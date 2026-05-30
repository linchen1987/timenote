import path from 'node:path';
import { type ConfigLocal, type FsTransport, initVault, metaPath } from '@timenote/core';
import { createNodeFsTransport } from '@timenote/core/fs/node-fs';
import type { Command } from 'commander';
import * as configStore from '../lib/config-store.js';
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
      let provider: import('@timenote/core').ProviderEntry, remotePath: string;
      try {
        ({ provider, remotePath } = await configStore.resolveProviderPath(providerPath));
      } catch (e: any) {
        console.error(e.message);
        process.exit(1);
      }

      const remote = createRemoteTransport(provider, remotePath);

      let manifest: Record<string, unknown>;
      try {
        const raw = await remote.read(metaPath('manifest'));
        manifest = JSON.parse(raw);
      } catch {
        console.error('Remote vault manifest not found.');
        process.exit(1);
      }

      const localDir = dir || manifest.name || manifest.project_id;
      const vaultDir = path.resolve(localDir);

      const transport = createNodeFsTransport(vaultDir);
      await initVault(transport, manifest.project_id, manifest.name);

      const remoteConfig: ConfigLocal = {
        remotes: [
          {
            url: buildRemoteUrl(provider.id, remotePath),
            name: 'origin',
            default: true,
          },
        ],
      };
      writeRemotes(vaultDir, remoteConfig);

      const sync = createSyncService(vaultDir);
      const result = await sync.initFromSource(remote);

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

function buildRemoteUrl(providerId: string, remotePath: string): string {
  if (remotePath) {
    return `${providerId}/${remotePath}`;
  }
  return providerId;
}
