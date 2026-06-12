import type { FsClientDriver } from '../../driver-registry';
import type { FsClient, FsClientConfig, FsClientStat } from '../../types';
import type { LocalFsClientConfig } from './types';

export function createOpfsClient(root: FileSystemDirectoryHandle): FsClient {
  return new OpfsClientImpl(root);
}

class OpfsClientImpl implements FsClient {
  readonly scheme = 'localfs' as const;
  readonly volumeUrl = 'localfs://';
  readonly url = 'localfs://';
  readonly rootPath = '/';
  readonly credentials = undefined;

  constructor(private root: FileSystemDirectoryHandle) {}

  async list(path: string): Promise<FsClientStat[]> {
    const dir = await this.resolveDir(path);
    const results: FsClientStat[] = [];

    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file') {
        const file = await (handle as FileSystemFileHandle).getFile();
        results.push({
          filename: path ? `${path}/${name}` : name,
          basename: name,
          lastmod: file.lastModified ? new Date(file.lastModified).toISOString() : '',
          size: file.size,
          type: 'file',
        });
      } else {
        results.push({
          filename: path ? `${path}/${name}` : name,
          basename: name,
          lastmod: '',
          size: 0,
          type: 'directory',
        });
      }
    }

    return results;
  }

  async read(path: string): Promise<string> {
    const [dirPath, fileName] = this.splitPath(path);
    const dir = await this.resolveDir(dirPath);
    const handle = await dir.getFileHandle(fileName);
    const file = await handle.getFile();
    return file.text();
  }

  async write(path: string, content: string): Promise<void> {
    const [dirPath, fileName] = this.splitPath(path);
    const dir = await this.ensureDirInternal(dirPath);
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(content);
    } finally {
      await writable.close();
    }
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    const [dirPath, fileName] = this.splitPath(path);
    const dir = await this.resolveDir(dirPath);
    const handle = await dir.getFileHandle(fileName);
    const file = await handle.getFile();
    return file.arrayBuffer();
  }

  async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
    const [dirPath, fileName] = this.splitPath(path);
    const dir = await this.ensureDirInternal(dirPath);
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(data);
    } finally {
      await writable.close();
    }
  }

  async remove(path: string): Promise<void> {
    const [dirPath, fileName] = this.splitPath(path);
    const dir = await this.resolveDir(dirPath);
    await dir.removeEntry(fileName);
  }

  async exists(path: string): Promise<boolean> {
    try {
      const [dirPath, fileName] = this.splitPath(path);
      const dir = await this.resolveDir(dirPath);
      await dir.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(path: string): Promise<void> {
    await this.ensureDirInternal(path);
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  private splitPath(path: string): [string, string] {
    const parts = path.split('/');
    const fileName = parts.pop() || '';
    return [parts.join('/'), fileName];
  }

  private async resolveDir(path: string): Promise<FileSystemDirectoryHandle> {
    if (!path) return this.root;
    let current = this.root;
    for (const part of path.split('/')) {
      if (!part) continue;
      current = await current.getDirectoryHandle(part);
    }
    return current;
  }

  private async ensureDirInternal(path: string): Promise<FileSystemDirectoryHandle> {
    if (!path) return this.root;
    let current = this.root;
    for (const part of path.split('/')) {
      if (!part) continue;
      current = await current.getDirectoryHandle(part, { create: true });
    }
    return current;
  }
}

export const LocalFsDriver: FsClientDriver = {
  create(config: FsClientConfig): FsClient {
    const localConfig = config as LocalFsClientConfig;
    let rootHandle: FileSystemDirectoryHandle | null = null;

    const getRoot = async (): Promise<FileSystemDirectoryHandle> => {
      if (rootHandle) return rootHandle;
      rootHandle = await navigator.storage.getDirectory();
      return rootHandle;
    };

    const lazyClient: FsClient = {
      async list(path: string): Promise<FsClientStat[]> {
        const root = await getRoot();
        const dir = await resolveDir(root, path);
        const results: FsClientStat[] = [];
        for await (const [name, handle] of dir.entries()) {
          if (handle.kind === 'file') {
            const file = await (handle as FileSystemFileHandle).getFile();
            results.push({
              filename: path ? `${path}/${name}` : name,
              basename: name,
              lastmod: file.lastModified ? new Date(file.lastModified).toISOString() : '',
              size: file.size,
              type: 'file',
            });
          } else {
            results.push({
              filename: path ? `${path}/${name}` : name,
              basename: name,
              lastmod: '',
              size: 0,
              type: 'directory',
            });
          }
        }
        return results;
      },

      async read(path: string): Promise<string> {
        const root = await getRoot();
        const [dirPath, fileName] = splitPath(path);
        const dir = await resolveDir(root, dirPath);
        const handle = await dir.getFileHandle(fileName);
        const file = await handle.getFile();
        return file.text();
      },

      async write(path: string, content: string): Promise<void> {
        const root = await getRoot();
        const [dirPath, fileName] = splitPath(path);
        const dir = await ensureDirInternal(root, dirPath);
        const handle = await dir.getFileHandle(fileName, { create: true });
        const writable = await handle.createWritable();
        try {
          await writable.write(content);
        } finally {
          await writable.close();
        }
      },

      async readBinary(path: string): Promise<ArrayBuffer> {
        const root = await getRoot();
        const [dirPath, fileName] = splitPath(path);
        const dir = await resolveDir(root, dirPath);
        const handle = await dir.getFileHandle(fileName);
        const file = await handle.getFile();
        return file.arrayBuffer();
      },

      async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
        const root = await getRoot();
        const [dirPath, fileName] = splitPath(path);
        const dir = await ensureDirInternal(root, dirPath);
        const handle = await dir.getFileHandle(fileName, { create: true });
        const writable = await handle.createWritable();
        try {
          await writable.write(data);
        } finally {
          await writable.close();
        }
      },

      async remove(path: string): Promise<void> {
        const root = await getRoot();
        const [dirPath, fileName] = splitPath(path);
        const dir = await resolveDir(root, dirPath);
        await dir.removeEntry(fileName);
      },

      async exists(path: string): Promise<boolean> {
        try {
          const root = await getRoot();
          const [dirPath, fileName] = splitPath(path);
          const dir = await resolveDir(root, dirPath);
          await dir.getFileHandle(fileName);
          return true;
        } catch {
          return false;
        }
      },

      async ensureDir(path: string): Promise<void> {
        const root = await getRoot();
        await ensureDirInternal(root, path);
      },

      scheme: 'localfs',
      volumeUrl: 'localfs://',
      url: 'localfs://',
      rootPath: localConfig.rootPath || '/',
      credentials: undefined,
      testConnection: async () => true,
    };

    return lazyClient;
  },
};

function splitPath(path: string): [string, string] {
  const parts = path.split('/');
  const fileName = parts.pop() || '';
  return [parts.join('/'), fileName];
}

async function resolveDir(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle> {
  if (!path) return root;
  let current = root;
  for (const part of path.split('/')) {
    if (!part) continue;
    current = await current.getDirectoryHandle(part);
  }
  return current;
}

async function ensureDirInternal(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle> {
  if (!path) return root;
  let current = root;
  for (const part of path.split('/')) {
    if (!part) continue;
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}
