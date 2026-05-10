import type { FsStat, FsTransport } from '../fs/types';

export interface OpfsTransport extends FsTransport {
  readBinary(path: string): Promise<ArrayBuffer>;
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;
  remove(path: string): Promise<void>;
  getRoot(): FileSystemDirectoryHandle;
}

export function createOpfsTransport(root: FileSystemDirectoryHandle): OpfsTransport {
  return new OpfsTransportImpl(root);
}

class OpfsTransportImpl implements OpfsTransport {
  constructor(private root: FileSystemDirectoryHandle) {}

  getRoot(): FileSystemDirectoryHandle {
    return this.root;
  }

  isConfigured(): boolean {
    return true;
  }

  async list(path: string): Promise<FsStat[]> {
    const dir = await this.resolveDir(path);
    const results: FsStat[] = [];

    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        results.push({
          filename: `${path}/${name}`,
          basename: name,
          lastmod: new Date(file.lastModified).toISOString(),
          size: file.size,
          type: 'file',
        });
      } else {
        results.push({
          filename: `${path}/${name}`,
          basename: name,
          lastmod: new Date().toISOString(),
          size: 0,
          type: 'directory',
        });
      }
    }

    return results;
  }

  async read(path: string): Promise<string> {
    const { dir, filename } = this.splitPath(path);
    const dirHandle = await this.resolveDir(dir);
    const fileHandle = await dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    const { dir, filename } = this.splitPath(path);
    const dirHandle = await this.resolveDir(dir);
    const fileHandle = await dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return file.arrayBuffer();
  }

  async write(path: string, content: string): Promise<void> {
    const { dir, filename } = this.splitPath(path);
    const dirHandle = await this.ensureDirInternal(dir);
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(content);
    } finally {
      await writable.close();
    }
  }

  async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
    const { dir, filename } = this.splitPath(path);
    const dirHandle = await this.ensureDirInternal(dir);
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(data);
    } finally {
      await writable.close();
    }
  }

  async remove(path: string): Promise<void> {
    const { dir, filename } = this.splitPath(path);
    const dirHandle = await this.resolveDir(dir);
    await dirHandle.removeEntry(filename);
  }

  async exists(path: string): Promise<boolean> {
    try {
      const { dir, filename } = this.splitPath(path);
      const dirHandle = await this.resolveDir(dir);
      await dirHandle.getFileHandle(filename);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(path: string): Promise<void> {
    await this.ensureDirInternal(path);
  }

  private splitPath(path: string): { dir: string; filename: string } {
    const parts = path.split('/').filter(Boolean);
    const filename = parts.pop()!;
    const dir = parts.join('/');
    return { dir, filename };
  }

  private async resolveDir(dirPath: string): Promise<FileSystemDirectoryHandle> {
    if (!dirPath) return this.root;
    const parts = dirPath.split('/').filter(Boolean);
    let current = this.root;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part);
    }
    return current;
  }

  private async ensureDirInternal(dirPath: string): Promise<FileSystemDirectoryHandle> {
    if (!dirPath) return this.root;
    const parts = dirPath.split('/').filter(Boolean);
    let current = this.root;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
    return current;
  }
}
