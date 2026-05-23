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
      let provider, remotePathStr;
      try {
        ({ provider, remotePath: remotePathStr } = await configStore.resolveProviderPath(providerPath));
      } catch (e: any) {
        console.error(e.message);
        process.exit(1);
      }

      const remotes = readRemotes(vaultDir);
      remotes[name] = { providerId: provider.id, path: remotePathStr, enabled: true };
      writeRemotes(vaultDir, remotes);
      console.log(`Remote "${name}" set.`);
    });

  remote
    .command('remove')
    .description('Remove a remote from the vault')
    .argument('<name>', 'Remote name')
    .option('--dir <dir>', 'Vault directory')
    .action(async (name: string, opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      const remotes = readRemotes(vaultDir);
      if (!(name in remotes)) {
        console.error(`Remote "${name}" not found.`);
        process.exit(1);
      }
      delete remotes[name];
      writeRemotes(vaultDir, remotes);
      console.log(`Remote "${name}" removed.`);
    });
}
