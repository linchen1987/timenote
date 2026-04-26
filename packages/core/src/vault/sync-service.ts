import type { FsTransport } from '../fs/types';
import { parseNoteSafe } from './frontmatter';
import { computeContentHash } from './hash';
import {
  isValidNoteFilename,
  isValidVolumeName,
  type NoteId,
  volumeNameFromNoteId,
} from './note-id';
import type { VaultNoteService } from './note-service';
import { type SyncEntity, type SyncLedger, SyncLedgerSchema } from './types';
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

const META_KEYS = ['manifest.json', 'menu.json', 'delete-log.json'];

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
    const local = this.vaultService.getOpfsTransport(projectId);
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

    for (const mf of META_KEYS) {
      try {
        const content = await local.read(`.timenote/${mf}`);
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
      const content = await remote.read('.timenote/sync-ledger.json');
      remoteLedger = SyncLedgerSchema.parse(JSON.parse(content));
    } catch {
      remoteLedger = {
        version: 1,
        last_sync_time: new Date().toISOString(),
        entities: {},
        meta_files: {},
      };
    }

    const notePlan = this.compareEntities(
      localLedger.entities,
      remoteLedger.entities,
      direction,
      result,
    );
    const metaPlan = this.compareEntities(
      localLedger.meta_files,
      remoteLedger.meta_files,
      direction,
      result,
    );

    const local = this.vaultService.getOpfsTransport(projectId);

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
          const content = await remote.read(`.timenote/${mf}`);
          await local.write(`.timenote/${mf}`, content);
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
          const content = await local.read(`.timenote/${mf}`);
          await remote.ensureDir('.timenote');
          await remote.write(`.timenote/${mf}`, content);
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

    const mergedEntities = this.mergeEntities(
      localLedger.entities,
      remoteLedger.entities,
      notePlan,
    );
    const mergedMeta = this.mergeEntities(
      localLedger.meta_files,
      remoteLedger.meta_files,
      metaPlan,
    );

    const mergedLedger: SyncLedger = {
      version: 1,
      last_sync_time: new Date().toISOString(),
      entities: mergedEntities,
      meta_files: mergedMeta,
    };

    await this.vaultService.writeSyncLedger(projectId, mergedLedger);
    try {
      await remote.ensureDir('.timenote');
      await remote.write('.timenote/sync-ledger.json', JSON.stringify(mergedLedger, null, 2));
    } catch (e) {
      result.errors.push(`Write remote ledger: ${(e as Error).message}`);
    }

    if (result.pulled > 0) {
      await this.noteService.rebuildIndex(projectId);
    }

    return result;
  }

  private compareEntities(
    localMap: Record<string, SyncEntity>,
    remoteMap: Record<string, SyncEntity>,
    direction: 'both' | 'pull' | 'push',
    result: SyncResult,
  ) {
    const toPull: string[] = [];
    const toPush: string[] = [];
    const toDeleteRemote: string[] = [];
    const toDeleteLocal: string[] = [];

    const allKeys = new Set([...Object.keys(localMap), ...Object.keys(remoteMap)]);

    for (const key of allKeys) {
      const local = localMap[key];
      const remote = remoteMap[key];

      const localAlive = local && !('d' in local);
      const localTomb = local && 'd' in local;
      const remoteAlive = remote && !('d' in remote);
      const remoteTomb = remote && 'd' in remote;

      if (!remote) {
        if (localTomb) {
          if (direction !== 'pull') toDeleteRemote.push(key);
        } else if (direction !== 'pull') {
          toPush.push(key);
        }
      } else if (!local) {
        if (remoteTomb) {
          if (direction !== 'push') toDeleteLocal.push(key);
        } else if (direction !== 'push') {
          toPull.push(key);
        }
      } else if (localAlive && remoteAlive) {
        if (local.h !== remote.h) {
          result.conflicts++;
          if (local.u > remote.u) {
            if (direction !== 'pull') toPush.push(key);
          } else if (direction !== 'push') {
            toPull.push(key);
          }
        }
      } else if (localAlive && remoteTomb) {
        result.conflicts++;
        if (local.u > remote.u) {
          if (direction !== 'pull') toPush.push(key);
        } else if (direction !== 'push') {
          toDeleteLocal.push(key);
        }
      } else if (localTomb && remoteAlive) {
        result.conflicts++;
        if (local.u > remote.u) {
          if (direction !== 'pull') toDeleteRemote.push(key);
        } else if (direction !== 'push') {
          toPull.push(key);
        }
      }
    }

    return { toPull, toPush, toDeleteRemote, toDeleteLocal };
  }

  private mergeEntities(
    localMap: Record<string, SyncEntity>,
    remoteMap: Record<string, SyncEntity>,
    plan: { toPull: string[]; toPush: string[]; toDeleteLocal: string[]; toDeleteRemote: string[] },
  ): Record<string, SyncEntity> {
    const merged: Record<string, SyncEntity> = {};
    const allKeys = new Set([...Object.keys(localMap), ...Object.keys(remoteMap)]);

    const pulledSet = new Set(plan.toPull);
    const pushedSet = new Set(plan.toPush);
    const delLocalSet = new Set(plan.toDeleteLocal);
    const delRemoteSet = new Set(plan.toDeleteRemote);

    for (const key of allKeys) {
      const local = localMap[key];
      const remote = remoteMap[key];

      if (pulledSet.has(key) || delLocalSet.has(key)) {
        if (remote) merged[key] = remote;
        else if (local) merged[key] = local;
      } else if (pushedSet.has(key) || delRemoteSet.has(key)) {
        if (local) merged[key] = local;
        else if (remote) merged[key] = remote;
      } else if (local) {
        merged[key] = local;
      } else if (remote) {
        merged[key] = remote;
      }
    }

    return merged;
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
