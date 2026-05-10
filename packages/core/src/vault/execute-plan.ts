import type { SyncPlan } from './sync-algorithm';
import type { VaultFs } from './vault-fs';

const META_DIR = '.timenote';

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

function splitDir(path: string): string | null {
  const parts = path.split('/');
  return parts.length > 1 ? parts[0] : null;
}

export async function executePlan(
  plan: SyncPlan,
  localFs: VaultFs,
  remoteFs: VaultFs,
  options?: { direction?: 'pull' | 'push' | 'both' },
): Promise<ExecuteResult> {
  const result: ExecuteResult = { pulled: 0, pushed: 0, errors: [] };
  const dir = options?.direction ?? 'both';

  if (dir !== 'push') {
    for (const key of plan.toPull) {
      try {
        const content = isMetaKey(key)
          ? await remoteFs.read(extractMetaPath(key))
          : await remoteFs.read(key);

        if (isMetaKey(key)) {
          await localFs.ensureDir(META_DIR);
          await localFs.write(extractMetaPath(key), content);
        } else {
          const dir = splitDir(key);
          if (dir) await localFs.ensureDir(dir);
          await localFs.write(key, content);
        }
        result.pulled++;
      } catch (e) {
        result.errors.push(`Pull ${key}: ${(e as Error).message}`);
      }
    }

    for (const key of plan.toDeleteLocal) {
      try {
        const path = isMetaKey(key) ? extractMetaPath(key) : key;
        await localFs.remove(path);
      } catch (e) {
        result.errors.push(`Delete local ${key}: ${(e as Error).message}`);
      }
    }
  }

  if (dir !== 'pull') {
    for (const key of plan.toPush) {
      try {
        const content = isMetaKey(key)
          ? await localFs.read(extractMetaPath(key))
          : await localFs.read(key);

        if (isMetaKey(key)) {
          await remoteFs.ensureDir(META_DIR);
          await remoteFs.write(extractMetaPath(key), content);
        } else {
          const dir = splitDir(key);
          if (dir) await remoteFs.ensureDir(dir);
          await remoteFs.write(key, content);
        }
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
        result.errors.push(`Delete remote ${key}: ${(e as Error).message}`);
      }
    }
  }

  return result;
}
