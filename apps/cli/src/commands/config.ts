import { extractScheme, parseS3Url, parseWebdavUrl } from '@timenote/core';
import type { Command } from 'commander';
import * as configStore from '../lib/config-store.js';
import { extractQuery, splitWebdavUserinfo, stripQuery } from '../lib/remote-resolver.js';

interface WebdavAddOptions {
  password?: string;
  port?: number;
  tls: boolean;
}

interface S3AddOptions {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
}

export function registerConfigCommand(program: Command) {
  const config = program.command('config').description('Manage configurations');

  const volume = config.command('volume').description('Manage storage volumes (webdav / s3)');

  const add = volume.command('add').description('Add a storage volume');

  add
    .command('webdav')
    .description('Add a WebDAV volume')
    .argument('<url>', 'WebDAV URL, e.g. webdav://[user[:password]@]host[/path]')
    .option('--password <password>', 'Password (overrides any password embedded in the URL)')
    .option('--port <port>', 'Port', parseInt)
    .option('--no-tls', 'Disable TLS (TLS is enabled by default)')
    .action(async (url: string, opts: WebdavAddOptions) => {
      if (extractScheme(url) !== 'webdav') {
        console.error(`Expected a webdav:// URL, got: ${url}`);
        process.exit(1);
      }
      const { password: inlinePassword, stripped } = splitWebdavUserinfo(url);
      const { host, username } = parseWebdavUrl(stripped);
      if (!host) {
        console.error('WebDAV URL is missing a host, e.g. webdav://user@host');
        process.exit(1);
      }
      const credential = {
        scheme: 'webdav' as const,
        host,
        username: username || '',
        password: opts.password ?? inlinePassword,
        tls: opts.tls !== false,
        port: opts.port,
      };
      const entry = await configStore.saveVolumeCredential(credential);
      console.log(`Volume saved: ${entry.volumeUrl}`);
    });

  add
    .command('s3')
    .description('Add an S3 volume')
    .argument('<url>', 'S3 URL, e.g. s3://bucket@endpoint[/path]')
    .option('--access-key-id <id>', 'Access key id (overrides any id embedded in the URL)')
    .option(
      '--secret-access-key <key>',
      'Secret access key (overrides any key embedded in the URL)',
    )
    .option('--region <region>', 'Region')
    .action(async (url: string, opts: S3AddOptions) => {
      if (extractScheme(url) !== 's3') {
        console.error(`Expected an s3:// URL, got: ${url}`);
        process.exit(1);
      }
      const { bucket, endpoint } = parseS3Url(stripQuery(url));
      if (!endpoint) {
        console.error('S3 URL is missing an endpoint, e.g. s3://bucket@endpoint');
        process.exit(1);
      }
      const qp = new URLSearchParams(extractQuery(url));
      const accessKeyId = opts.accessKeyId ?? qp.get('accessKeyId') ?? undefined;
      const secretAccessKey = opts.secretAccessKey ?? qp.get('secretAccessKey') ?? undefined;
      if (!accessKeyId || !secretAccessKey) {
        console.error(
          'S3 volume requires --access-key-id and --secret-access-key (or embed ?accessKeyId=&secretAccessKey= in the URL).',
        );
        process.exit(1);
      }
      const credential = {
        scheme: 's3' as const,
        endpoint,
        bucket,
        accessKeyId,
        secretAccessKey,
        region: opts.region ?? qp.get('region') ?? undefined,
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
