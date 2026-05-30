import type { FsTransport } from './transport';

export interface VaultStorage {
  list(): Promise<string[]>;
  getTransport(projectId: string): Promise<FsTransport>;
  remove(projectId: string): Promise<void>;
}
