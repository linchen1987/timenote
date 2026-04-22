import type { FsStat, FsTransport } from './types';

const existingDirs = new Set<string>();

export function createFsService(transport: FsTransport) {
  return {
    isConfigured: () => transport.isConfigured(),

    async list(path: string): Promise<FsStat[]> {
      const result = await transport.list(path);
      return Array.isArray(result) ? result : [result];
    },

    async read(path: string): Promise<string> {
      const result = await transport.read(path);
      existingDirs.add(path.split('/').slice(0, -1).join('/') || '/');
      return result;
    },

    async write(path: string, content: string): Promise<void> {
      await transport.write(path, content);
      existingDirs.add(path.split('/').slice(0, -1).join('/') || '/');
    },

    async exists(path: string): Promise<boolean> {
      if (existingDirs.has(path)) return true;
      try {
        await transport.exists(path);
        existingDirs.add(path);
        return true;
      } catch {
        return false;
      }
    },

    async ensureDir(path: string): Promise<void> {
      const parts = path.split('/').filter(Boolean);
      let current = '';
      let needsEnsure = false;

      for (const part of parts) {
        current += `/${part}`;
        if (!existingDirs.has(current)) {
          needsEnsure = true;
          break;
        }
      }

      if (!needsEnsure) return;

      await transport.ensureDir(path);

      current = '';
      for (const part of parts) {
        current += `/${part}`;
        existingDirs.add(current);
      }
    },

    clearCache() {
      existingDirs.clear();
    },
  };
}

export type FsService = ReturnType<typeof createFsService>;
