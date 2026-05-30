import type { Command } from 'commander';
import * as configStore from '../lib/config-store.js';
import { readRemotes, resolveVaultDir, writeRemotes } from '../lib/vault.js';

export function registerRemoteCommand(program: Command) {
  const remote = program.command('remote').description('Manage vault remote configuration');

  remote
    .command('set')
    .description('Set a remote for the vault')
    .argument('<name>', 'Remote name (e.g. origin)')
    .argument('<provider-path>', 'providerId:remotePath')
    .option('--dir <dir>', 'Vault directory')
    .action(async (name: string, providerPath: string, opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      let provider: import('@timenote/core').ProviderEntry, remotePathStr: string;
      try {
        ({ provider, remotePath: remotePathStr } =
          await configStore.resolveProviderPath(providerPath));
      } catch (e: any) {
        console.error(e.message);
        process.exit(1);
      }

      const url = remotePathStr ? `${provider.id}/${remotePathStr}` : provider.id;

      const config = readRemotes(vaultDir);
      const existingIdx = config.remotes.findIndex((r) => r.name === name);
      const entry = { url, name, default: name === 'origin' };

      if (existingIdx >= 0) {
        config.remotes[existingIdx] = entry;
      } else {
        config.remotes.push(entry);
      }

      writeRemotes(vaultDir, config);
      console.log(`Remote "${name}" set.`);
    });

  remote
    .command('remove')
    .description('Remove a remote from the vault')
    .argument('<name>', 'Remote name')
    .option('--dir <dir>', 'Vault directory')
    .action(async (name: string, opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      const config = readRemotes(vaultDir);
      const idx = config.remotes.findIndex((r) => r.name === name);
      if (idx < 0) {
        console.error(`Remote "${name}" not found.`);
        process.exit(1);
      }
      config.remotes.splice(idx, 1);
      writeRemotes(vaultDir, config);
      console.log(`Remote "${name}" removed.`);
    });

  remote
    .command('list')
    .description('List vault remotes')
    .option('--dir <dir>', 'Vault directory')
    .action(async (opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      const config = readRemotes(vaultDir);
      if (config.remotes.length === 0) {
        console.log('No remotes configured.');
        return;
      }
      for (const r of config.remotes) {
        const flag = r.default ? ' (default)' : '';
        console.log(`${r.name || '(unnamed)'}  ${r.url}${flag}`);
      }
    });
}
