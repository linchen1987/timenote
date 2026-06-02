import path from 'node:path';
import { type FsProviderEntry, initVault, metaPath, providerFacade } from '@timenote/core';
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
      '<provider-path>',
      'providerId:remotePath (e.g. "webdav:user@url:timenote/vaults/vX")',
    )
    .argument('[dir]', 'Local directory name (defaults to notebook name)')
    .action(async (providerPath: string, dir?: string) => {
      let provider: FsProviderEntry, remotePath: string;
      try {
        ({ provider, remotePath } = await configStore.resolveProviderPath(providerPath));
      } catch (e: any) {
        console.error(e.message);
        process.exit(1);
      }

      const store = await configStore.createFileProviderStore();
      const remoteUrl = buildRemoteUrl(provider.id, remotePath);
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

      const transport = providerFacade.create({ type: 'fs', path: vaultDir });
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
