import type { FsClient } from '../fs/client';
import type { SyncPlan } from './sync-algorithm';

const META_DIR = '.timenote';
const ASSETS_DIR = 'assets';

export interface ExecuteResult {
  pulled: number;
  pushed: number;
  errors: string[];
}

function isMetaKey(key: string): boolean {
  return key.startsWith('meta:');
}

function extractMetaPath(key: string): string {
  return `${META_DIR}/${key.slice(5)}`;
}

function isAttachmentKey(key: string): boolean {
  return key.startsWith(`${ASSETS_DIR}/`);
}

const OPFS_NOT_FOUND =
  'A requested file or directory could not be found at the time an operation was processed';

function isNotFoundError(e: unknown): boolean {
  const msg = (e as Error).message || '';
  if (msg.includes(OPFS_NOT_FOUND)) return true;
  if (msg.includes('404') || msg.includes('Not Found')) return true;
  return false;
}

function splitDir(path: string): string | null {
  const parts = path.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : null;
}

async function pullEntity(key: string, localFs: FsClient, remoteFs: FsClient): Promise<void> {
  if (isMetaKey(key)) {
    const content = await remoteFs.read(extractMetaPath(key));
    await localFs.ensureDir(META_DIR);
    await localFs.write(extractMetaPath(key), content);
  } else if (isAttachmentKey(key)) {
    const data = await remoteFs.readBinary(key);
    const dir = splitDir(key);
    if (dir) await localFs.ensureDir(dir);
    await localFs.writeBinary(key, data);
  } else {
    const content = await remoteFs.read(key);
    const dir = splitDir(key);
    if (dir) await localFs.ensureDir(dir);
    await localFs.write(key, content);
  }
}

async function pushEntity(key: string, localFs: FsClient, remoteFs: FsClient): Promise<void> {
  if (isMetaKey(key)) {
    const content = await localFs.read(extractMetaPath(key));
    await remoteFs.ensureDir(META_DIR);
    await remoteFs.write(extractMetaPath(key), content);
  } else if (isAttachmentKey(key)) {
    const data = await localFs.readBinary(key);
    const dir = splitDir(key);
    if (dir) await remoteFs.ensureDir(dir);
    await remoteFs.writeBinary(key, data);
  } else {
    const content = await localFs.read(key);
    const dir = splitDir(key);
    if (dir) await remoteFs.ensureDir(dir);
    await remoteFs.write(key, content);
  }
}

export async function executePlan(
  plan: SyncPlan,
  localFs: FsClient,
  remoteFs: FsClient,
  options?: { direction?: 'pull' | 'push' | 'both' },
): Promise<ExecuteResult> {
  const result: ExecuteResult = { pulled: 0, pushed: 0, errors: [] };
  const dir = options?.direction ?? 'both';

  if (dir !== 'push') {
    for (const key of plan.toPull) {
      try {
        await pullEntity(key, localFs, remoteFs);
        result.pulled++;
      } catch (e) {
        result.errors.push(`Pull ${key}: ${(e as Error).message}`);
      }
    }

    // 必须计入 pulled 以触发索引重建和 UI 刷新。
    // 远端驱动的本地删除也是 pulled 变更的一部分，
    for (const key of plan.toDeleteLocal) {
      try {
        const path = isMetaKey(key) ? extractMetaPath(key) : key;
        await localFs.remove(path);
        result.pulled++;
      } catch (e) {
        if (!isNotFoundError(e)) {
          result.errors.push(`Delete local ${key}: ${(e as Error).message}`);
        }
      }
    }
  }

  if (dir !== 'pull') {
    for (const key of plan.toPush) {
      try {
        await pushEntity(key, localFs, remoteFs);
        result.pushed++;
      } catch (e) {
        result.errors.push(`Push ${key}: ${(e as Error).message}`);
      }
    }

    for (const key of plan.toDeleteRemote) {
      try {
        const path = isMetaKey(key) ? extractMetaPath(key) : key;
        await remoteFs.remove(path);
      } catch (e) {
        if (!isNotFoundError(e)) {
          result.errors.push(`Delete remote ${key}: ${(e as Error).message}`);
        }
      }
    }
  }

  return result;
}
