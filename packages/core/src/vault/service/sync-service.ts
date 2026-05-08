import type { FsTransport } from '../../fs/types';
// TODO: WebDAV rate limiting — add delay between transfers and abort on consecutive errors
// when uploading many files. S3 handles burst well but WebDAV servers (e.g. Koofr) throttle.
import { computeContentHash } from '../spec/hash';
import { type NoteId, parseNoteSafe } from '../spec/note';
import { isValidNoteFilename, isValidVolumeName, volumeNameFromNoteId } from '../spec/note-id';
import { type SyncEntity, type SyncLedger, SyncLedgerSchema } from '../spec/sync-ledger';
import { META_DIR, metaPath, SYNCABLE_META_FILES, syncLedgerPath } from '../spec/vault-layout';
import type { VaultNoteService } from './note-service';
import { compareEntities, mergeEntities } from './sync-algorithm';
import type { VaultService } from './vault-service';

export interface RemoteTransport extends FsTransport {
  remove(path: string): Promise<void>;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: number;
  errors: string[];
}

export interface SyncStatus {
  lastSyncTime: string | null;
  isSyncing: boolean;
}

export interface VaultSyncService {
  sync(projectId: string, remote: RemoteTransport): Promise<SyncResult>;
  pull(projectId: string, remote: RemoteTransport): Promise<SyncResult>;
  push(projectId: string, remote: RemoteTransport): Promise<SyncResult>;
  getSyncStatus(projectId: string): Promise<SyncStatus>;
  buildLocalLedger(projectId: string): Promise<SyncLedger>;
}

export function createVaultSyncService(
  vaultService: VaultService,
  noteService: VaultNoteService,
): VaultSyncService {
  return new VaultSyncServiceImpl(vaultService, noteService);
}

class VaultSyncServiceImpl implements VaultSyncService {
  constructor(
    private vaultService: VaultService,
    private noteService: VaultNoteService,
  ) {}

  async sync(projectId: string, remote: RemoteTransport): Promise<SyncResult> {
    return this.doSync(projectId, remote, 'both');
  }

  async pull(projectId: string, remote: RemoteTransport): Promise<SyncResult> {
    return this.doSync(projectId, remote, 'pull');
  }

  async push(projectId: string, remote: RemoteTransport): Promise<SyncResult> {
    return this.doSync(projectId, remote, 'push');
  }

  async getSyncStatus(projectId: string): Promise<SyncStatus> {
    try {
      const ledger = await this.vaultService.readSyncLedger(projectId);
      return { lastSyncTime: ledger.last_sync_time, isSyncing: false };
    } catch {
      return { lastSyncTime: null, isSyncing: false };
    }
  }

  async buildLocalLedger(projectId: string): Promise<SyncLedger> {
    const local = this.vaultService.getTransport(projectId);
    const entities: Record<string, SyncEntity> = {};
    const metaFiles: Record<string, SyncEntity> = {};

    const volumes = await local.list('');
    for (const vol of volumes) {
      if (vol.type !== 'directory' || !isValidVolumeName(vol.basename)) continue;
      const items = await local.list(vol.basename);
      for (const item of items) {
        if (item.type === 'file' && isValidNoteFilename(item.basename)) {
          const path = `${vol.basename}/${item.basename}`;
          try {
            const content = await local.read(path);
            const parsed = parseNoteSafe(content);
            const updatedAt = parsed?.frontmatter.updated_at || new Date().toISOString();
            entities[path] = { h: await computeContentHash(content), u: updatedAt };
          } catch {
            // skip unreadable files
          }
        }
      }
    }

    for (const mf of SYNCABLE_META_FILES) {
      try {
        const content = await local.read(metaPath(mf as 'manifest' | 'menu' | 'deleteLog'));
        metaFiles[mf] = { h: await computeContentHash(content), u: new Date().toISOString() };
      } catch {
        // skip missing meta files
      }
    }

    try {
      const deleteLog = await this.vaultService.readDeleteLog(projectId);
      for (const [noteId, deletedAt] of Object.entries(deleteLog.records)) {
        const vol = volumeNameFromNoteId(noteId as NoteId);
        const path = `${vol}/${noteId}.md`;
        if (!entities[path]) {
          entities[path] = { d: true, u: deletedAt };
        }
      }
    } catch {
      // skip if delete-log doesn't exist
    }

    let lastSyncTime = new Date().toISOString();
    try {
      const existing = await this.vaultService.readSyncLedger(projectId);
      lastSyncTime = existing.last_sync_time;
    } catch {
      // use default
    }

    return { version: 1, last_sync_time: lastSyncTime, entities, meta_files: metaFiles };
  }

  private async doSync(
    projectId: string,
    remote: RemoteTransport,
    direction: 'both' | 'pull' | 'push',
  ): Promise<SyncResult> {
    const result: SyncResult = { pulled: 0, pushed: 0, conflicts: 0, errors: [] };

    const localLedger = await this.buildLocalLedger(projectId);

    let remoteLedger: SyncLedger;
    try {
      const content = await remote.read(syncLedgerPath());
      remoteLedger = SyncLedgerSchema.parse(JSON.parse(content));
    } catch {
      remoteLedger = {
        version: 1,
        last_sync_time: new Date().toISOString(),
        entities: {},
        meta_files: {},
      };
    }

    const notePlan = compareEntities(localLedger.entities, remoteLedger.entities, direction);
    result.conflicts += notePlan.conflicts;
    const metaPlan = compareEntities(localLedger.meta_files, remoteLedger.meta_files, direction);
    result.conflicts += metaPlan.conflicts;

    const local = this.vaultService.getTransport(projectId);

    if (direction !== 'push') {
      for (const key of notePlan.toPull) {
        try {
          const content = await remote.read(key);
          await local.write(key, content);
          result.pulled++;
        } catch (e) {
          result.errors.push(`Pull ${key}: ${(e as Error).message}`);
        }
      }
      for (const mf of metaPlan.toPull) {
        try {
          const mp = metaPath(mf as 'manifest' | 'menu' | 'deleteLog');
          const content = await remote.read(mp);
          await local.write(mp, content);
          result.pulled++;
        } catch (e) {
          result.errors.push(`Pull meta ${mf}: ${(e as Error).message}`);
        }
      }
      for (const key of notePlan.toDeleteLocal) {
        try {
          await local.remove(key);
          result.pulled++;
        } catch (e) {
          result.errors.push(`Delete local ${key}: ${(e as Error).message}`);
        }
      }
    }

    if (direction !== 'pull') {
      for (const key of notePlan.toPush) {
        try {
          const content = await local.read(key);
          await remote.write(key, content);
          result.pushed++;
        } catch (e) {
          result.errors.push(`Push ${key}: ${(e as Error).message}`);
        }
      }
      for (const mf of metaPlan.toPush) {
        try {
          const mp = metaPath(mf as 'manifest' | 'menu' | 'deleteLog');
          const content = await local.read(mp);
          await remote.ensureDir(META_DIR);
          await remote.write(mp, content);
          result.pushed++;
        } catch (e) {
          result.errors.push(`Push meta ${mf}: ${(e as Error).message}`);
        }
      }
      for (const key of notePlan.toDeleteRemote) {
        try {
          await remote.remove(key);
          result.pushed++;
        } catch (e) {
          result.errors.push(`Delete remote ${key}: ${(e as Error).message}`);
        }
      }
    }

    const mergedEntities = mergeEntities(localLedger.entities, remoteLedger.entities, notePlan);
    const mergedMeta = mergeEntities(localLedger.meta_files, remoteLedger.meta_files, metaPlan);

    const mergedLedger: SyncLedger = {
      version: 1,
      last_sync_time: new Date().toISOString(),
      entities: mergedEntities,
      meta_files: mergedMeta,
    };

    await this.vaultService.writeSyncLedger(projectId, mergedLedger);
    try {
      await remote.ensureDir(META_DIR);
      await remote.write(syncLedgerPath(), JSON.stringify(mergedLedger, null, 2));
    } catch (e) {
      result.errors.push(`Write remote ledger: ${(e as Error).message}`);
    }

    if (result.pulled > 0) {
      await this.noteService.rebuildIndex(projectId);
    }

    return result;
  }
}

export function createPrefixedTransport(
  prefix: string,
  transport: RemoteTransport,
): RemoteTransport {
  const p = prefix.replace(/\/+$/, '');
  const resolve = (path: string) => (path ? `${p}/${path}` : p);
  return {
    list: (path) => transport.list(resolve(path)),
    read: (path) => transport.read(resolve(path)),
    write: (path, content) => transport.write(resolve(path), content),
    exists: (path) => transport.exists(resolve(path)),
    ensureDir: (path) => transport.ensureDir(resolve(path)),
    remove: (path) => transport.remove(resolve(path)),
    isConfigured: () => transport.isConfigured(),
  };
}
