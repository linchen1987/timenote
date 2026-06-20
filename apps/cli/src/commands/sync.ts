import type { FsVolumeCredentialStore } from '@timenote/core';
import type { Command } from 'commander';
import * as configStore from '../lib/config-store.js';
import {
  createRemoteConfigServiceForVault,
  createRemoteProviderFromUrl,
  createSyncService,
  resolveVaultDir,
} from '../lib/vault.js';

export function registerPullCommand(program: Command) {
  program
    .command('pull')
    .description('Pull updates from remote')
    .option('--dir <dir>', 'Vault directory')
    .action(async (opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      const store = await configStore.createFileProviderStore();
      const { remote, remoteName } = await resolveRemote(vaultDir, store);
      const sync = createSyncService(vaultDir);
      const result = await sync.pull(remote);

      console.log(`Pulled from "${remoteName}": ${result.pulled} file(s).`);
      if (result.errors.length > 0) {
        for (const e of result.errors) {
          console.error(`  Error: ${e}`);
        }
      }
    });
}

export function registerPushCommand(program: Command) {
  program
    .command('push')
    .description('Push updates to remote')
    .option('--dir <dir>', 'Vault directory')
    .action(async (opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      const store = await configStore.createFileProviderStore();
      const { remote, remoteName } = await resolveRemote(vaultDir, store);
      const sync = createSyncService(vaultDir);
      const result = await sync.push(remote);

      console.log(`Pushed to "${remoteName}": ${result.pushed} file(s).`);
      if (result.errors.length > 0) {
        for (const e of result.errors) {
          console.error(`  Error: ${e}`);
        }
      }
    });
}

export function registerSyncCommand(program: Command) {
  program
    .command('sync')
    .description('Sync with remote (bidirectional)')
    .option('--dir <dir>', 'Vault directory')
    .action(async (opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      const store = await configStore.createFileProviderStore();
      const { remote, remoteName } = await resolveRemote(vaultDir, store);
      const sync = createSyncService(vaultDir);
      const result = await sync.sync(remote);

      console.log(
        `Synced with "${remoteName}": pulled ${result.pulled}, pushed ${result.pushed}, conflicts ${result.conflicts}.`,
      );
      if (result.errors.length > 0) {
        for (const e of result.errors) {
          console.error(`  Error: ${e}`);
        }
      }
    });
}

async function resolveRemote(vaultDir: string, store: FsVolumeCredentialStore) {
  const service = createRemoteConfigServiceForVault(vaultDir);
  const entry = await service.getDefaultRemote();
  if (!entry) {
    throw new Error('No remote configured. Use "timenote remote set" to add one.');
  }

  const remoteName = entry.name || 'origin';
  return {
    remote: createRemoteProviderFromUrl(entry.url, store),
    remoteName,
  };
}
