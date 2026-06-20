import {
  createNoteOp,
  createVaultSyncService,
  type FsClient,
  ManifestSchema,
  metaPath,
  noteFilePath,
  type SyncResult,
  updateNoteOp,
} from '@timenote/core';
import { createMemoryProvider } from '@timenote/core/fs/adapters/memory';

/** Read the project id from a remote vault's manifest. */
export async function readRemoteProjectId(remote: FsClient): Promise<string> {
  const manifestPath = metaPath('manifest');
  let raw: string;
  try {
    raw = await remote.read(manifestPath);
  } catch (e) {
    if (isNotFound(e)) {
      throw new Error(
        [
          `Vault not found at this remote path — manifest is missing.`,
          `  remote:  ${remote.url}`,
          `  looked for: ${joinRemotePath(remote.rootPath, manifestPath)}`,
          `Check that --remote <url> (or TIMENOTE_REMOTE_URL) points to an initialized vault.`,
        ].join('\n'),
      );
    }
    throw e;
  }
  return ManifestSchema.parse(JSON.parse(raw)).project_id;
}

function joinRemotePath(rootPath: string, file: string): string {
  if (!rootPath || rootPath === '/') return file;
  return `${rootPath.replace(/\/+$/, '')}/${file}`;
}

function isNotFound(e: unknown): boolean {
  const err = e as { statusCode?: number; code?: string; message?: string };
  if (err?.statusCode === 404) return true;
  if (err?.code && ['NoSuchKey', 'NoSuchBucket', 'NotFound', 'ENOENT'].includes(err.code)) {
    return true;
  }
  return /404|not found|does not exist/i.test(err?.message || '');
}

function assertNoErrors(result: SyncResult): void {
  if (result.errors.length > 0) {
    throw new Error(`Remote sync failed:\n${result.errors.join('\n')}`);
  }
}

/**
 * Minimal VaultService-like object that always returns the given in-memory
 * client as the "local" side. The sync engine drives it through getLocalClient.
 */
function memoryVaultService(local: FsClient) {
  return {
    async getLocalClient(_projectId: string): Promise<FsClient> {
      return local;
    },
  };
}

/**
 * Create a note directly on a remote vault in a single, stateless operation.
 *
 * The note is staged in an in-memory FsClient, then pushed via the sync engine
 * (direction=push). Push semantics never delete remote-only files, and the
 * merged ledger preserves the remote's full history — so only the new note
 * file + an updated ledger are written remotely. No local checkout is left
 * behind.
 */
export async function createNoteRemote(remote: FsClient, content: string): Promise<string> {
  const projectId = await readRemoteProjectId(remote);
  const local = createMemoryProvider();
  const noteId = await createNoteOp(local, content);

  const syncSvc = createVaultSyncService(memoryVaultService(local) as never);
  const result = await syncSvc.push(projectId, remote);
  assertNoErrors(result);
  return noteId;
}

/**
 * Update an existing note directly on a remote vault.
 *
 * The current note is fetched from the remote into memory (so metadata like
 * created_at is preserved), rewritten there, then pushed back.
 */
export async function updateNoteRemote(
  remote: FsClient,
  noteId: string,
  content: string,
): Promise<void> {
  const projectId = await readRemoteProjectId(remote);
  const local = createMemoryProvider();

  const path = noteFilePath(noteId);
  const existing = await remote.read(path);
  await local.write(path, existing);

  await updateNoteOp(local, noteId, content);

  const syncSvc = createVaultSyncService(memoryVaultService(local) as never);
  const result = await syncSvc.push(projectId, remote);
  assertNoErrors(result);
}
