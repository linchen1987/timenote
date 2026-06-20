import type { Command } from 'commander';
import * as configStore from '../lib/config-store.js';

export function registerConfigCommand(program: Command) {
  const config = program.command('config').description('Manage provider configurations');

  config
    .command('add-provider')
    .description('Add a storage provider (webdav or s3)')
    .argument('<type>', 'Provider type: webdav or s3')
    .option('--host <host>', 'WebDAV server host')
    .option('--username <username>', 'WebDAV username')
    .option('--password <password>', 'WebDAV password')
    .option('--token <token>', 'WebDAV auth token')
    .option('--no-tls', 'Disable TLS for WebDAV')
    .option('--port <port>', 'WebDAV port', parseInt)
    .option('--bucket <bucket>', 'S3 bucket name')
    .option('--endpoint <endpoint>', 'S3 endpoint')
    .option('--access-key-id <id>', 'S3 access key ID')
    .option('--secret-access-key <key>', 'S3 secret access key')
    .option('--region <region>', 'S3 region')
    .action(async (type: string, opts: Record<string, any>) => {
      if (type !== 'webdav' && type !== 's3') {
        console.error(`Invalid provider type: ${type}. Use "webdav" or "s3".`);
        process.exit(1);
      }

      const entry = await configStore.saveVolumeCredential({
        type,
        ...(type === 'webdav'
          ? {
              host: opts.host!,
              username: opts.username ?? '',
              password: opts.password,
              token: opts.token,
              tls: opts.tls !== false ? undefined : false,
              port: opts.port,
            }
          : {
              endpoint: opts.endpoint!,
              bucket: opts.bucket!,
              accessKeyId: opts.accessKeyId!,
              secretAccessKey: opts.secretAccessKey!,
              region: opts.region,
            }),
      } as any);
      console.log(`Provider saved: ${entry.volumeUrl}`);
    });

  config
    .command('list-providers')
    .description('List all configured providers')
    .action(async () => {
      const credentials = await configStore.listVolumeCredentials();
      if (credentials.length === 0) {
        console.log('No providers configured.');
        return;
      }
      for (const a of credentials) {
        if ('host' in a) {
          console.log(`${a.volumeUrl}  (webdav: ${a.host})`);
        } else if ('bucket' in a) {
          console.log(`${a.volumeUrl}  (s3: ${a.bucket})`);
        }
      }
    });

  config
    .command('remove-provider')
    .description('Remove a provider by ID')
    .argument('<id>', 'Provider ID')
    .action(async (id: string) => {
      await configStore.deleteVolumeCredential(id);
      console.log(`Provider removed: ${id}`);
    });
}
