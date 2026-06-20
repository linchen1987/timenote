import type { Command } from 'commander';
import * as configStore from '../lib/config-store.js';

export function registerConfigCommand(program: Command) {
  const config = program.command('config').description('Manage volume configurations');

  const volume = config.command('volume').description('Manage storage volumes (webdav / s3)');

  volume
    .command('add')
    .description('Add a storage volume')
    .argument('<scheme>', 'Volume scheme: webdav or s3')
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
    .action(async (scheme: string, opts: Record<string, any>) => {
      if (scheme !== 'webdav' && scheme !== 's3') {
        console.error(`Invalid volume scheme: ${scheme}. Use "webdav" or "s3".`);
        process.exit(1);
      }

      const credential =
        scheme === 'webdav'
          ? {
              scheme: 'webdav' as const,
              host: opts.host!,
              username: opts.username ?? '',
              password: opts.password,
              tls: opts.tls !== false ? undefined : false,
              port: opts.port,
            }
          : {
              scheme: 's3' as const,
              endpoint: opts.endpoint!,
              bucket: opts.bucket!,
              accessKeyId: opts.accessKeyId!,
              secretAccessKey: opts.secretAccessKey!,
              region: opts.region,
            };

      const entry = await configStore.saveVolumeCredential(credential);
      console.log(`Volume saved: ${entry.volumeUrl}`);
    });

  volume
    .command('list')
    .description('List all configured volumes')
    .action(async () => {
      const credentials = await configStore.listVolumeCredentials();
      if (credentials.length === 0) {
        console.log('No volumes configured.');
        return;
      }
      for (const v of credentials) {
        if (v.scheme === 'webdav') {
          console.log(`${v.volumeUrl}  (webdav: ${v.host})`);
        } else if (v.scheme === 's3') {
          console.log(`${v.volumeUrl}  (s3: ${v.bucket})`);
        }
      }
    });

  volume
    .command('show')
    .description('Show details of a volume by its volumeUrl')
    .argument('<volumeUrl>', 'Volume URL (e.g. webdav://user@host)')
    .action(async (volumeUrl: string) => {
      const entry = await configStore.getVolumeCredential(volumeUrl);
      if (!entry) {
        console.error(`Volume not found: ${volumeUrl}`);
        process.exit(1);
      }
      console.log(JSON.stringify(entry, null, 2));
    });

  volume
    .command('remove')
    .description('Remove a volume by its volumeUrl')
    .argument('<volumeUrl>', 'Volume URL to remove')
    .action(async (volumeUrl: string) => {
      const existing = await configStore.getVolumeCredential(volumeUrl);
      if (!existing) {
        console.error(`Volume not found: ${volumeUrl}`);
        process.exit(1);
      }
      await configStore.deleteVolumeCredential(volumeUrl);
      console.log(`Volume removed: ${volumeUrl}`);
    });
}
