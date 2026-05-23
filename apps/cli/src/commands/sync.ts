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
  const remotes = readRemotes(vaultDir);
  const entries = Object.entries(remotes).filter(([, e]) => e.enabled);
  if (entries.length === 0) {
    throw new Error('No remote configured. Use "timenote remote set" to add one.');
  }

  const [remoteName, entry] = entries[0];
  const provider = await configStore.getProvider(entry.providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${entry.providerId}`);
  }

  return {
    remote: createRemoteTransport(provider, entry.path),
    remoteName,
  };
}
