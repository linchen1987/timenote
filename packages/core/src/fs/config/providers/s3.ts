import { createS3Transport } from '../../s3';
import type { ProviderDef } from '../provider-def';

// ─── S3 Types ───────────────────────────────────────────────

export type S3Identity = { type: 's3'; endpoint: string; bucket: string };

export type S3Config = S3Identity & {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
};

export type S3TransportParams = {
  type: 's3';
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

// ─── S3 Provider Definition ─────────────────────────────────

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

  serializeParams(config) {
    return {
      type: 's3',
      endpoint: config.endpoint,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
    };
  },

  createTransportFromParams(params) {
    return createS3Transport({
      endpoint: (params.endpoint as string) ?? '',
      bucket: params.bucket as string,
      accessKeyId: params.accessKeyId as string,
      secretAccessKey: params.secretAccessKey as string,
      region: params.region as string | undefined,
    });
  },
};
