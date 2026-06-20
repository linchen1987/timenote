import path from 'node:path';
import { createFsClient, initVault, metaPath } from '@timenote/core';
import type { Command } from 'commander';
import * as configStore from '../lib/config-store.js';
import {
  buildRemoteUrl,
  createRemoteConfigServiceForVault,
  createRemoteProviderFromUrl,
  createSyncService,
} from '../lib/vault.js';

export function registerCloneCommand(program: Command) {
  program
    .command('clone')
    .description('Clone a notebook from remote to local directory')
    .argument(
      '<volume-path>',
      'volumeUrl:remotePath (e.g. "webdav://user@host:timenote/vaults/vX")',
    )
    .argument('[dir]', 'Local directory name (defaults to notebook name)')
    .action(async (volumePath: string, dir?: string) => {
      let volume: { volumeUrl: string }, remotePath: string;
      try {
        ({ volume, remotePath } = await configStore.resolveVolumePath(volumePath));
      } catch (e: any) {
        console.error(e.message);
        process.exit(1);
      }

      const store = await configStore.loadVolumeStore();
      const remoteUrl = buildRemoteUrl(volume.volumeUrl, remotePath);
      const remote = createRemoteProviderFromUrl(remoteUrl, store);

      let manifest: Record<string, unknown>;
      try {
        const raw = await remote.read(metaPath('manifest'));
        manifest = JSON.parse(raw);
      } catch {
        console.error('Remote vault manifest not found.');
        process.exit(1);
      }

      const localDir = dir || (manifest.name as string) || (manifest.project_id as string);
      const vaultDir = path.resolve(localDir);

      const transport = createFsClient({ scheme: 'localfs', rootPath: vaultDir });
      await initVault(transport, manifest.project_id as string, manifest.name as string);

      const service = createRemoteConfigServiceForVault(vaultDir);
      await service.setRemote({
        url: remoteUrl,
        name: 'origin',
        default: true,
      });

      const sync = createSyncService(vaultDir);
      const result = await sync.initFromSource(remote);

      console.log(`Cloned to ${localDir}/ (${manifest.name as string})`);
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
