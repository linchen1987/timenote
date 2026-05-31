import type { FsProvider } from '../fs/provider';

export interface VaultRegistryEntry {
  projectId: string;
  sourceUrl: string;
  name: string;
}

export interface VaultRegistry {
  list(): Promise<VaultRegistryEntry[]>;
  get(projectId: string): Promise<VaultRegistryEntry | null>;
  register(projectId: string, name: string): Promise<VaultRegistryEntry>;
  unregister(projectId: string): Promise<void>;
  destroy(projectId: string): Promise<void>;
  getProvider(projectId: string): Promise<FsProvider>;
}
