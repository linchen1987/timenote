import type { FsStat, FsTransport } from './transport';
import type { VaultStorage } from './vault-storage';

export function createOpfsTransport(root: FileSystemDirectoryHandle): FsTransport {
  return new OpfsTransportImpl(root);
}

export async function createOpfsVaultStorage(): Promise<VaultStorage> {
  const opfsRoot = await navigator.storage.getDirectory();
  const vaultsDir = await opfsRoot.getDirectoryHandle('vaults', { create: true });
  return new OpfsVaultStorageImpl(vaultsDir);
}

class OpfsTransportImpl implements FsTransport {
  constructor(private root: FileSystemDirectoryHandle) {}

  async list(path: string): Promise<FsStat[]> {
    const dir = await this.resolveDir(path);
    const results: FsStat[] = [];

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

class OpfsVaultStorageImpl implements VaultStorage {
  constructor(private vaultsDir: FileSystemDirectoryHandle) {}

  async list(): Promise<string[]> {
    const names: string[] = [];
    for await (const [name, handle] of this.vaultsDir.entries()) {
      if (handle.kind === 'directory') names.push(name);
    }
    return names;
  }

  async getTransport(projectId: string): Promise<FsTransport> {
    const dir = await this.vaultsDir.getDirectoryHandle(projectId, { create: true });
    return createOpfsTransport(dir);
  }

  async remove(projectId: string): Promise<void> {
    await this.vaultsDir.removeEntry(projectId, { recursive: true });
  }
}
