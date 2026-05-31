import type { FsProvider } from '../provider';

export type StorageProviderType = 'fs' | 's3' | 'webdav';

export type StorageProviderIdentity =
  | { type: 'fs' }
  | { type: 's3'; endpoint: string; bucket: string }
  | { type: 'webdav'; host: string; username: string };

export type StorageProviderConfig =
  | { type: 'fs' }
  | {
      type: 's3';
      endpoint: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      region?: string;
    }
  | {
      type: 'webdav';
      host: string;
      username: string;
      password?: string;
      token?: string;
      tls?: boolean;
      port?: number;
    };

export interface ProviderModule<
  I extends StorageProviderIdentity = StorageProviderIdentity,
  C = void,
> {
  scheme: string;
  generateId(identity: I): string;
  parseSource(userinfo: string, host: string, path: string): I & { path: string };
  create(identity: I, config: C): FsProvider;
}

export type AnyProviderModule = ProviderModule<StorageProviderIdentity, unknown>;
