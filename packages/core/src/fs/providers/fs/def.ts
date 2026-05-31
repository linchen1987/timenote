import type { FsProvider, FsProviderStat } from '../../provider';
import type { ProviderModule, StorageProviderIdentity } from '../module';

export type FsIdentity = { type: 'fs' };
export type FsConfig = FsIdentity;

const runtimeFactories = new Map<string, (path: string) => FsProvider>();

export function registerRuntimeFactory(id: string, factory: (path: string) => FsProvider): void {
  runtimeFactories.set(id, factory);
}

export function getRuntimeFactory(id: string): ((path: string) => FsProvider) | null {
  return runtimeFactories.get(id) ?? null;
}

export const fsModule: ProviderModule<FsIdentity, void> = {
  scheme: 'fs',

  generateId(): string {
    return 'fs://';
  },

  parseSource(_userinfo: string, _host: string, path: string): FsIdentity & { path: string } {
    return { type: 'fs', path };
  },

  create(identity: FsIdentity & { path?: string }, _config: void): FsProvider {
    const factory = getRuntimeFactory('fs://');
    if (!factory) throw new Error('No runtime factory registered for fs://');
    return factory((identity as { path: string }).path ?? '');
  },
};
