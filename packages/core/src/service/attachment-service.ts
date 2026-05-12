import type { OpfsTransport } from '../provider/opfs-transport';
import { computeBinaryHash } from '../spec/hash';
import { ASSETS_DIR, assetPath } from '../spec/vault-layout';

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  zip: 'application/zip',
  txt: 'text/plain',
  json: 'application/json',
};

export function inferMimeFromExt(ext: string): string | undefined {
  return MIME_MAP[ext.toLowerCase()];
}

export function inferMimeFromPath(path: string): string | undefined {
  const ext = path.split('.').pop();
  return ext ? inferMimeFromExt(ext) : undefined;
}

export function extFromFilename(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return '';
  return filename.slice(dot + 1).toLowerCase();
}

export async function computeAssetPath(file: File | ArrayBuffer, ext: string): Promise<string> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const hash = await computeBinaryHash(buffer);
  return assetPath(hash, ext);
}

export interface AttachmentWriteResult {
  path: string;
  hash: string;
  existed: boolean;
}

export function createAttachmentService(transport: OpfsTransport) {
  return {
    async write(path: string, data: ArrayBuffer): Promise<void> {
      const dir = path.split('/').slice(0, -1).join('/');
      if (dir) await transport.ensureDir(dir);
      await transport.writeBinary(path, data);
    },

    async read(path: string): Promise<ArrayBuffer> {
      return transport.readBinary(path);
    },

    async remove(path: string): Promise<void> {
      await transport.remove(path);
    },

    async exists(path: string): Promise<boolean> {
      return transport.exists(path);
    },

    async writeIfNew(data: ArrayBuffer, ext: string): Promise<AttachmentWriteResult> {
      const hash = await computeBinaryHash(data);
      const path = assetPath(hash, ext);
      const alreadyExists = await transport.exists(path);
      if (!alreadyExists) {
        const dir = `${ASSETS_DIR}/${hash.slice(0, 2)}`;
        await transport.ensureDir(dir);
        await transport.writeBinary(path, data);
      }
      return { path, hash, existed: alreadyExists };
    },

    async listAll(): Promise<string[]> {
      const paths: string[] = [];
      try {
        const shards = await transport.list(ASSETS_DIR);
        for (const shard of shards) {
          if (shard.type !== 'directory') continue;
          const files = await transport.list(shard.filename);
          for (const file of files) {
            if (file.type === 'file') {
              paths.push(file.filename);
            }
          }
        }
      } catch {
        // assets directory may not exist yet
      }
      return paths;
    },
  };
}

export type AttachmentService = ReturnType<typeof createAttachmentService>;
