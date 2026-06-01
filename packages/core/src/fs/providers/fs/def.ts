import type { FsClient } from '../../client';
import type { FsProviderEntry, FsProviderStore, FsProvider } from '../provider';

export type FsIdentity = { type: 'fs' };
export type FsEndpoint = FsIdentity & { path: string };
export type FsAccount = FsIdentity;
export type FsConfig = FsIdentity & { path: string };

const runtimeFactories = new Map<string, (path: string) => FsClient>();

export function registerRuntimeFactory(id: string, factory: (path: string) => FsClient): void {
  runtimeFactories.set(id, factory);
}

export function getRuntimeFactory(id: string): ((path: string) => FsClient) | null {
  return runtimeFactories.get(id) ?? null;
}

export const fsProvider: FsProvider<FsIdentity> = {
  scheme: 'fs',

  getProviderId(): string {
    return 'fs://';
  },

  parseUrl(url: string): FsConfig {
    const protoIdx = url.indexOf('://');
    if (protoIdx < 0 || url.slice(0, protoIdx) !== 'fs') {
      throw new Error(`Invalid fs URL: ${url}`);
    }
    return { type: 'fs', path: url.slice(protoIdx + 3) || '/' };
  },

  buildUrl(endpoint: FsEndpoint): string {
    if (!endpoint.path || endpoint.path === '/') return 'fs://';
    return `fs://${endpoint.path}`;
  },

  create(config: FsConfig): FsClient {
    const factory = getRuntimeFactory('fs://');
    if (!factory) throw new Error('No runtime factory registered for fs://');
    return factory(config.path);
  },

  async testConnection(config: FsConfig): Promise<boolean> {
    try {
      const client = this.create(config);
      return await client.exists('/');
    } catch {
      return false;
    }
  },

  toEntry(account: FsAccount): FsProviderEntry {
    return { ...account, id: this.getProviderId(account) };
  },

  resolveConfigFromUrl(url: string, _store: FsProviderStore): FsConfig {
    const endpoint = this.parseUrl(url);
    return { type: 'fs', path: endpoint.path };
  },

  createFromUrl(url: string, store: FsProviderStore): FsClient {
    return this.create(this.resolveConfigFromUrl(url, store));
  },
};
