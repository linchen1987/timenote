import type { FsTransport } from './transport';

export function createPrefixedTransport(prefix: string, transport: FsTransport): FsTransport {
  const p = prefix.replace(/\/+$/, '');
  const resolve = (path: string) => (path ? `${p}/${path}` : p);
  return {
    list: (path) => transport.list(resolve(path)),
    read: (path) => transport.read(resolve(path)),
    write: (path, content) => transport.write(resolve(path), content),
    readBinary: (path) => transport.readBinary(resolve(path)),
    writeBinary: (path, data) => transport.writeBinary(resolve(path), data),
    exists: (path) => transport.exists(resolve(path)),
    ensureDir: (path) => transport.ensureDir(resolve(path)),
    remove: (path) => transport.remove(resolve(path)),
  };
}
