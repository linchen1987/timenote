import type { Logger } from '../vault/log-service';
import { isInsideLogWrite } from '../vault/log-service';
import { getDriver } from './driver-registry';
import type { FsClient, FsClientConfig, FsScheme, FsVolumeAccessStore } from './types';
import { resolveFsConfig } from './url';

export interface CreateFsClientOptions {
  store?: FsVolumeAccessStore;
  logger?: Logger;
}

const READ_METHODS = new Set(['read', 'readBinary', 'exists']);

function levelForError(method: string): 'warn' | 'error' {
  if (READ_METHODS.has(method) || method === 'list') return 'warn';
  return 'error';
}

async function withLog<T>(
  logger: Logger,
  method: string,
  path: string,
  fn: () => Promise<T>,
  options?: { meta?: Record<string, unknown> },
): Promise<T> {
  if (isInsideLogWrite()) return fn();
  const start = Date.now();
  try {
    const result = await fn();
    logger.info(`${method} ${path}`, { ok: true, ms: Date.now() - start, ...options?.meta });
    return result;
  } catch (e) {
    logger.log(levelForError(method), `${method} ${path}`, {
      ok: false,
      ms: Date.now() - start,
      error: (e as Error)?.message ?? String(e),
      ...options?.meta,
    });
    throw e;
  }
}

function createLoggingFsClient(inner: FsClient, logger: Logger): FsClient {
  return {
    get scheme() {
      return inner.scheme;
    },
    get volumeUrl() {
      return inner.volumeUrl;
    },
    get url() {
      return inner.url;
    },
    get rootPath() {
      return inner.rootPath;
    },
    get credentials() {
      return inner.credentials;
    },

    list: (path: string) => withLog(logger, 'list', path, () => inner.list(path)),

    read: (path: string) => withLog(logger, 'read', path, () => inner.read(path)),

    write: (path: string, content: string) =>
      withLog(logger, 'write', path, () => inner.write(path, content), {
        meta: { bytes: content.length },
      }),

    readBinary: (path: string) => withLog(logger, 'readBinary', path, () => inner.readBinary(path)),

    writeBinary: (path: string, data: ArrayBuffer) =>
      withLog(logger, 'writeBinary', path, () => inner.writeBinary(path, data), {
        meta: { bytes: data.byteLength },
      }),

    remove: (path: string) => withLog(logger, 'remove', path, () => inner.remove(path)),

    exists: (path: string) => withLog(logger, 'exists', path, () => inner.exists(path)),

    ensureDir: (path: string) => withLog(logger, 'ensureDir', path, () => inner.ensureDir(path)),

    testConnection: () => withLog(logger, 'testConnection', '', () => inner.testConnection()),
  };
}

export function createFsClient(
  configOrUrl: FsClientConfig | string,
  options?: CreateFsClientOptions,
): FsClient {
  const config =
    typeof configOrUrl === 'string' ? resolveFsConfig(configOrUrl, options?.store) : configOrUrl;
  let client = getDriver(config.scheme as FsScheme).create(config);
  if (options?.logger) {
    client = createLoggingFsClient(client, options.logger);
  }
  return client;
}
