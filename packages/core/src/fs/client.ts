export interface FsClient {
  list(path: string): Promise<FsClientStat[]>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  readBinary(path: string): Promise<ArrayBuffer>;
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;
  remove(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
}

export type FsClientStat = {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: 'file' | 'directory';
  mime?: string;
  etag?: string | null;
};

export function scopeToPath(prefix: string, client: FsClient): FsClient {
  const p = prefix.replace(/\/+$/, '');
  const resolve = (path: string) => (path ? `${p}/${path}` : p);
  return {
    list: (path) => client.list(resolve(path)),
    read: (path) => client.read(resolve(path)),
    write: (path, content) => client.write(resolve(path), content),
    readBinary: (path) => client.readBinary(resolve(path)),
    writeBinary: (path, data) => client.writeBinary(resolve(path), data),
    exists: (path) => client.exists(resolve(path)),
    ensureDir: (path) => client.ensureDir(resolve(path)),
    remove: (path) => client.remove(resolve(path)),
  };
}
