import type { FsTransport } from '../fs/transport';

export interface VaultRegistry {
  list(): Promise<string[]>;
  getTransport(projectId: string): Promise<FsTransport>;
  remove(projectId: string): Promise<void>;
}
