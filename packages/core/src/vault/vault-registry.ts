import type { FsClient } from '../fs/types';

/*
 * permanent: delete vault data and unregister vault from registry
 * unregister: only unregister vault from registry
 */
export type VaultDeleteBehavior = 'permanent' | 'unregister';

export interface VaultRegistryEntry {
  projectId: string;
  sourceUrl: string;
  name: string;
}

export interface VaultRegistry {
  list(): Promise<VaultRegistryEntry[]>;
  get(projectId: string): Promise<VaultRegistryEntry | null>;
  register(projectId: string, name: string): Promise<VaultRegistryEntry>;
  registerExisting?(projectId: string, path: string, name: string): Promise<VaultRegistryEntry>;
  unregister(projectId: string): Promise<void>;
  destroy(projectId: string): Promise<void>;
  getDeleteBehavior?(): VaultDeleteBehavior;
  getLocalClient(projectId: string): Promise<FsClient>;
}
