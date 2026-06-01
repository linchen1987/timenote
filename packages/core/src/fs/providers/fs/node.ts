import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FsClient, FsClientStat } from '../../client';

export function createNodeFsClient(rootDir: string): FsClient {
  const resolve = (p: string) => path.join(rootDir, p);

  return {
    async list(dirPath: string): Promise<FsClientStat[]> {
      const entries = await fs.readdir(resolve(dirPath), { withFileTypes: true });
      return entries.map((e) => ({
        filename: dirPath ? `${dirPath}/${e.name}` : e.name,
        basename: e.name,
        lastmod: new Date().toISOString(),
        size: 0,
        type: e.isDirectory() ? ('directory' as const) : ('file' as const),
      }));
    },

    async read(filePath: string): Promise<string> {
      return fs.readFile(resolve(filePath), 'utf-8');
    },

    async write(filePath: string, content: string): Promise<void> {
      const full = resolve(filePath);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, 'utf-8');
    },

    async readBinary(filePath: string): Promise<ArrayBuffer> {
      const buf = await fs.readFile(resolve(filePath));
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },

    async writeBinary(filePath: string, data: ArrayBuffer): Promise<void> {
      const full = resolve(filePath);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, Buffer.from(data));
    },

    async remove(filePath: string): Promise<void> {
      await fs.unlink(resolve(filePath)).catch(() => {});
    },

    async exists(filePath: string): Promise<boolean> {
      return fs.access(resolve(filePath)).then(
        () => true,
        () => false,
      );
    },

    async ensureDir(dirPath: string): Promise<void> {
      await fs.mkdir(resolve(dirPath), { recursive: true });
    },
  };
}
