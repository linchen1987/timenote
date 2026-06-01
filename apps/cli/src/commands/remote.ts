import type { Command } from 'commander';
import * as configStore from '../lib/config-store.js';
import { createRemoteConfigServiceForVault, resolveVaultDir } from '../lib/vault.js';

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
      let provider: import('@timenote/core').FsProviderEntry, remotePathStr: string;
      try {
        ({ provider, remotePath: remotePathStr } =
          await configStore.resolveProviderPath(providerPath));
      } catch (e: any) {
        console.error(e.message);
        process.exit(1);
      }

      const url = remotePathStr ? `${provider.id}/${remotePathStr}` : provider.id;
      const service = createRemoteConfigServiceForVault(vaultDir);
      await service.setRemote({ url, name, default: name === 'origin' });
      console.log(`Remote "${name}" set.`);
    });

  remote
    .command('remove')
    .description('Remove a remote from the vault')
    .argument('<name>', 'Remote name')
    .option('--dir <dir>', 'Vault directory')
    .action(async (name: string, opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      const service = createRemoteConfigServiceForVault(vaultDir);
      const existing = await service.getRemote(name);
      if (!existing) {
        console.error(`Remote "${name}" not found.`);
        process.exit(1);
      }
      await service.removeRemote(name);
      console.log(`Remote "${name}" removed.`);
    });

  remote
    .command('list')
    .description('List vault remotes')
    .option('--dir <dir>', 'Vault directory')
    .action(async (opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      const service = createRemoteConfigServiceForVault(vaultDir);
      const remotes = await service.listRemotes();
      if (remotes.length === 0) {
        console.log('No remotes configured.');
        return;
      }
      for (const r of remotes) {
        const flag = r.default ? ' (default)' : '';
        console.log(`${r.name || '(unnamed)'}  ${r.url}${flag}`);
      }
    });
}
