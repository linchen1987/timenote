import { generateProviderId, parseRemoteUrl } from '@timenote/core';
import type { Command } from 'commander';
import * as configStore from '../lib/config-store.js';
import {
  createRemoteTransport,
  createSyncService,
  readRemotes,
  resolveVaultDir,
} from '../lib/vault.js';

export function registerPullCommand(program: Command) {
  program
    .command('pull')
    .description('Pull updates from remote')
    .option('--dir <dir>', 'Vault directory')
    .action(async (opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      const { remote, remoteName } = await resolveRemote(vaultDir);
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
      const { remote, remoteName } = await resolveRemote(vaultDir);
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
      const { remote, remoteName } = await resolveRemote(vaultDir);
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

async function resolveRemote(vaultDir: string) {
  const config = readRemotes(vaultDir);
  const remotes = config.remotes;
  if (remotes.length === 0) {
    throw new Error('No remote configured. Use "timenote remote set" to add one.');
  }

  const entry = remotes[0];
  const remoteName = entry.name || 'origin';

  const parsed = parseRemoteUrl(entry.url);
  const providerId = generateProviderId(parsed);
  const provider = await configStore.getProvider(providerId);
  if (!provider) {
    throw new Error(`Provider not found for URL: ${entry.url}`);
  }

  return {
    remote: createRemoteTransport(provider, parsed.path),
    remoteName,
  };
}
