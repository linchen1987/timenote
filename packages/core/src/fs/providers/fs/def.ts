import type { FsProvider } from '../../provider';
import type { ProviderModule } from '../module';

export type FsIdentity = { type: 'fs' };
export type FsEndpoint = FsIdentity & { path: string };
export type FsAccount = FsIdentity;
export type FsConfig = FsIdentity & { path: string };

const runtimeFactories = new Map<string, (path: string) => FsProvider>();

export function registerRuntimeFactory(id: string, factory: (path: string) => FsProvider): void {
  runtimeFactories.set(id, factory);
}

export function getRuntimeFactory(id: string): ((path: string) => FsProvider) | null {
  return runtimeFactories.get(id) ?? null;
}

export const fsModule: ProviderModule<FsIdentity> = {
  scheme: 'fs',

  getProviderId(): string {
    return 'fs://';
  },

  parseSource(_userinfo: string, _host: string, path: string): FsConfig {
    return { type: 'fs', path };
  },

  create(config: FsConfig): FsProvider {
    const factory = getRuntimeFactory('fs://');
    if (!factory) throw new Error('No runtime factory registered for fs://');
    return factory(config.path);
  },
};
