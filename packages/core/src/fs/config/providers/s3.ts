import { createS3Transport } from '../../s3';
import type { ProviderDef } from '../provider-def';

export type S3Identity = { type: 's3'; endpoint: string; bucket: string };

export type S3Config = S3Identity & {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
};

export const s3Def: ProviderDef<S3Identity, S3Config> = {
  scheme: 's3',

  generateId({ bucket, endpoint }) {
    return `s3://${bucket}@${endpoint}`;
  },

  parseSource(userinfo, host, path) {
    return { type: 's3', bucket: userinfo, endpoint: host, path };
  },

  createTransport(config) {
    return createS3Transport({
      endpoint: config.endpoint,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
    });
  },
};
