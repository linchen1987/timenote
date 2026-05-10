import type { FsStat } from '../../fs/types';
import type { OpfsTransport } from '../provider/opfs-transport';

export interface VaultFs {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
  list(path: string): Promise<FsStat[]>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
}

export function createOpfsVaultFs(transport: OpfsTransport): VaultFs {
  return transport;
}

export function createTransportVaultFs(transport: {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
  list(path: string): Promise<FsStat[]>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
}): VaultFs {
  return transport;
}
