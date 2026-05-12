import type { FsTransport } from '../fs/types';
import type { VaultNoteService } from '../service/note-service';
import type { SyncLedger } from '../spec/sync-ledger';
import { META_DIR } from '../spec/vault-layout';
import type { DirtyEntry } from './build-ledger';
import {
  applyDirtyEntries,
  buildEmptyLedger,
  buildLedgerFromFile,
  buildLedgerFromFs,
} from './build-ledger';
import type { ExecuteResult } from './execute-plan';
import { executePlan } from './execute-plan';
import { resolve, type SyncDirection } from './sync-algorithm';
import { createOpfsVaultFs, type VaultFs } from './vault-fs';
import type { VaultService } from './vault-service';
import { writeLedger } from './write-ledger';

export interface RemoteTransport extends FsTransport {
  remove(path: string): Promise<void>;
  readBinary(path: string): Promise<ArrayBuffer>;
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: number;
  errors: string[];
}

export interface SyncStatus {
  isSyncing: boolean;
}

export interface SyncOptions {
  direction?: SyncDirection;
  writeSourceLedger?: boolean;
  localLedgerMode?: 'incremental' | 'empty';
}

export interface VaultSyncService {
  sync(projectId: string, remote: RemoteTransport): Promise<SyncResult>;
  pull(projectId: string, remote: RemoteTransport): Promise<SyncResult>;
  push(projectId: string, remote: RemoteTransport): Promise<SyncResult>;
  initFromSource(
    projectId: string,
    source: VaultFs,
    options?: { writeSourceLedger?: boolean },
  ): Promise<SyncResult>;
  syncWithSource(projectId: string, source: VaultFs, options?: SyncOptions): Promise<SyncResult>;
  getSyncStatus(projectId: string): Promise<SyncStatus>;
  loadLedgerCache(projectId: string): Promise<void>;
  markDirty(projectId: string, entries: DirtyEntry[]): void;
}

export function createVaultSyncService(
  vaultService: VaultService,
  noteService: VaultNoteService,
): VaultSyncService {
  return new VaultSyncServiceImpl(vaultService, noteService);
}

export function toVaultFs(remote: RemoteTransport): VaultFs {
  return {
    read: (path) => remote.read(path),
    write: (path, content) => remote.write(path, content),
    readBinary: (path) => remote.readBinary(path),
    writeBinary: (path, data) => remote.writeBinary(path, data),
    remove: (path) => remote.remove(path),
    list: (path) => remote.list(path),
    exists: (path) => remote.exists(path),
    ensureDir: (path) => remote.ensureDir(path),
  };
}

async function buildSourceLedger(source: VaultFs): Promise<SyncLedger> {
  try {
    return await buildLedgerFromFile(source);
  } catch {
    return buildLedgerFromFs(source);
  }
}

class VaultSyncServiceImpl implements VaultSyncService {
  private ledgerCache = new Map<string, SyncLedger>();
  private dirtyMap = new Map<string, DirtyEntry[]>();

  constructor(
    private vaultService: VaultService,
    private noteService: VaultNoteService,
  ) {}

  async sync(projectId: string, remote: RemoteTransport): Promise<SyncResult> {
    return this.doSync(projectId, toVaultFs(remote), {
      direction: 'both',
      writeSourceLedger: true,
      localLedgerMode: 'incremental',
    });
  }

  async pull(projectId: string, remote: RemoteTransport): Promise<SyncResult> {
    return this.doSync(projectId, toVaultFs(remote), {
      direction: 'pull',
      writeSourceLedger: true,
      localLedgerMode: 'incremental',
    });
  }

  async push(projectId: string, remote: RemoteTransport): Promise<SyncResult> {
    return this.doSync(projectId, toVaultFs(remote), {
      direction: 'push',
      writeSourceLedger: true,
      localLedgerMode: 'incremental',
    });
  }

  async initFromSource(
    projectId: string,
    source: VaultFs,
    options?: { writeSourceLedger?: boolean },
  ): Promise<SyncResult> {
    return this.doSync(projectId, source, {
      direction: 'pull',
      writeSourceLedger: options?.writeSourceLedger ?? false,
      localLedgerMode: 'empty',
    });
  }

  async syncWithSource(
    projectId: string,
    source: VaultFs,
    options?: SyncOptions,
  ): Promise<SyncResult> {
    return this.doSync(projectId, source, {
      direction: options?.direction ?? 'pull',
      writeSourceLedger: options?.writeSourceLedger ?? false,
      localLedgerMode: options?.localLedgerMode ?? 'incremental',
    });
  }

  async getSyncStatus(_projectId: string): Promise<SyncStatus> {
    return { isSyncing: false };
  }

  async loadLedgerCache(projectId: string): Promise<void> {
    try {
      const fs = createOpfsVaultFs(this.vaultService.getTransport(projectId));
      const ledger = await buildLedgerFromFile(fs);
      this.ledgerCache.set(projectId, ledger);
    } catch {
      this.ledgerCache.set(projectId, buildEmptyLedger());
    }
    this.dirtyMap.delete(projectId);
  }

  markDirty(projectId: string, entries: DirtyEntry[]): void {
    const existing = this.dirtyMap.get(projectId);
    if (existing) {
      existing.push(...entries);
    } else {
      this.dirtyMap.set(projectId, [...entries]);
    }
  }

  private async buildIncrementalLedger(projectId: string): Promise<SyncLedger> {
    const cached = this.ledgerCache.get(projectId);
    if (!cached) {
      const fs = createOpfsVaultFs(this.vaultService.getTransport(projectId));
      const ledger = await buildLedgerFromFs(fs);
      this.ledgerCache.set(projectId, ledger);
      return ledger;
    }

    const dirty = this.dirtyMap.get(projectId);
    if (!dirty || dirty.length === 0) return cached;

    const fs = createOpfsVaultFs(this.vaultService.getTransport(projectId));
    const updated = await applyDirtyEntries(fs, cached, dirty);
    this.dirtyMap.delete(projectId);
    this.ledgerCache.set(projectId, updated);
    return updated;
  }

  private async doSync(
    projectId: string,
    source: VaultFs,
    options: SyncOptions & { writeSourceLedger: boolean; localLedgerMode: string },
  ): Promise<SyncResult> {
    const direction = options.direction ?? 'both';

    const localLedger =
      options.localLedgerMode === 'empty'
        ? buildEmptyLedger()
        : await this.buildIncrementalLedger(projectId);

    const sourceLedger = await buildSourceLedger(source);

    const session = resolve(localLedger, sourceLedger, direction);

    const localFs = createOpfsVaultFs(this.vaultService.getTransport(projectId));

    const execResult: ExecuteResult = await executePlan(session.plan, localFs, source, {
      direction,
    });

    if (execResult.errors.length === 0) {
      await writeLedger(localFs, session.mergedLedger);
      this.ledgerCache.set(projectId, session.mergedLedger);
      this.dirtyMap.delete(projectId);

      if (options.writeSourceLedger) {
        try {
          await source.ensureDir(META_DIR);
          await writeLedger(source, session.mergedLedger);
        } catch (e) {
          execResult.errors.push(`Write source ledger: ${(e as Error).message}`);
        }
      }
    } else {
      this.ledgerCache.delete(projectId);
    }

    if (execResult.pulled > 0) {
      await this.noteService.rebuildIndex(projectId);
    }

    return {
      pulled: execResult.pulled,
      pushed: execResult.pushed,
      conflicts: session.plan.conflicts,
      errors: execResult.errors,
    };
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
    readBinary: (path) => transport.readBinary(resolve(path)),
    writeBinary: (path, data) => transport.writeBinary(resolve(path), data),
    exists: (path) => transport.exists(resolve(path)),
    ensureDir: (path) => transport.ensureDir(resolve(path)),
    remove: (path) => transport.remove(resolve(path)),
    isConfigured: () => transport.isConfigured(),
  };
}
