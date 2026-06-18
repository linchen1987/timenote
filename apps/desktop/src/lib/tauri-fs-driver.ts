import type { FsClientDriver } from '@timenote/core';
import type { FsClient, FsClientConfig, FsClientStat } from '@timenote/core';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';

interface RawDirEntry {
  name: string;
  is_directory: boolean;
}

export class TauriFsClient implements FsClient {
  readonly scheme = 'localfs' as const;
  readonly volumeUrl: string;
  readonly url: string;
  readonly rootPath: string;
  readonly credentials = undefined;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.volumeUrl = `localfs://${rootPath}`;
    this.url = `localfs://${rootPath}`;
  }

  private async resolve(path: string): Promise<string> {
    if (!path) return this.rootPath;
    return join(this.rootPath, path);
  }

  async list(path: string): Promise<FsClientStat[]> {
    const fullPath = await this.resolve(path);
    const entries = await invoke<RawDirEntry[]>('fs_read_dir', { path: fullPath });
    return entries.map((e) => ({
      filename: path ? `${path}/${e.name}` : e.name,
      basename: e.name,
      lastmod: new Date().toISOString(),
      size: 0,
      type: e.is_directory ? ('directory' as const) : ('file' as const),
    }));
  }

  async read(path: string): Promise<string> {
    const fullPath = await this.resolve(path);
    return invoke<string>('fs_read_text_file', { path: fullPath });
  }

  async write(path: string, content: string): Promise<void> {
    const fullPath = await this.resolve(path);
    await invoke<void>('fs_write_text_file', { path: fullPath, content });
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    const fullPath = await this.resolve(path);
    const data = await invoke<number[]>('fs_read_file', { path: fullPath });
    return new Uint8Array(data).buffer;
  }

  async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
    const fullPath = await this.resolve(path);
    await invoke<void>('fs_write_file', { path: fullPath, data: Array.from(new Uint8Array(data)) });
  }

  async remove(path: string): Promise<void> {
    await invoke<void>('fs_remove', { path: await this.resolve(path), recursive: false }).catch(() => {});
  }

  async exists(path: string): Promise<boolean> {
    return invoke<boolean>('fs_exists', { path: await this.resolve(path) });
  }

  async ensureDir(path: string): Promise<void> {
    await invoke<void>('fs_mkdir', { path: await this.resolve(path) });
  }

  async testConnection(): Promise<boolean> {
    return invoke<boolean>('fs_exists', { path: this.rootPath });
  }
}

export const TauriFsDriver: FsClientDriver = {
  create(config: FsClientConfig): FsClient {
    const rootPath = (config as { rootPath?: string }).rootPath || '/';
    return new TauriFsClient(rootPath);
  },
};
