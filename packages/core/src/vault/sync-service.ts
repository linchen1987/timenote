import type { FsClient } from '../fs/types';
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
import type { Logger } from './log-service';
import { resolve, type SyncDirection } from './sync-algorithm';
import type { VaultService } from './vault-service';
import { writeLedger } from './write-ledger';

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
  sync(projectId: string, remote: FsClient, logger?: Logger): Promise<SyncResult>;
  pull(projectId: string, remote: FsClient, logger?: Logger): Promise<SyncResult>;
  push(projectId: string, remote: FsClient, logger?: Logger): Promise<SyncResult>;
  initFromSource(
    projectId: string,
    source: FsClient,
    options?: { writeSourceLedger?: boolean },
    logger?: Logger,
  ): Promise<SyncResult>;
  syncWithSource(
    projectId: string,
    source: FsClient,
    options?: SyncOptions,
    logger?: Logger,
  ): Promise<SyncResult>;
  getSyncStatus(projectId: string): Promise<SyncStatus>;
  loadLedgerFromVault(projectId: string): Promise<void>;
  rebuildLedger(projectId: string): Promise<void>;
  markDirty(projectId: string, entries: DirtyEntry[]): void;
}

export interface SyncServiceCallbacks {
  onPullComplete?: (projectId: string) => Promise<void>;
}

export function createVaultSyncService(
  vaultService: VaultService,
  callbacks?: SyncServiceCallbacks,
): VaultSyncService {
  return new VaultSyncServiceImpl(vaultService, callbacks);
}

async function buildSourceLedger(source: FsClient): Promise<SyncLedger> {
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
    private callbacks?: SyncServiceCallbacks,
  ) {}

  async sync(projectId: string, remote: FsClient, logger?: Logger): Promise<SyncResult> {
    return this.doSync(projectId, remote, {
      direction: 'both',
      writeSourceLedger: true,
      localLedgerMode: 'incremental',
      logger,
    });
  }

  async pull(projectId: string, remote: FsClient, logger?: Logger): Promise<SyncResult> {
    return this.doSync(projectId, remote, {
      direction: 'pull',
      writeSourceLedger: true,
      localLedgerMode: 'incremental',
      logger,
    });
  }

  async push(projectId: string, remote: FsClient, logger?: Logger): Promise<SyncResult> {
    return this.doSync(projectId, remote, {
      direction: 'push',
      writeSourceLedger: true,
      localLedgerMode: 'incremental',
      logger,
    });
  }

  async initFromSource(
    projectId: string,
    source: FsClient,
    options?: { writeSourceLedger?: boolean },
    logger?: Logger,
  ): Promise<SyncResult> {
    return this.doSync(projectId, source, {
      direction: 'pull',
      writeSourceLedger: options?.writeSourceLedger ?? false,
      localLedgerMode: 'empty',
      logger,
    });
  }

  async syncWithSource(
    projectId: string,
    source: FsClient,
    options?: SyncOptions,
    logger?: Logger,
  ): Promise<SyncResult> {
    return this.doSync(projectId, source, {
      direction: options?.direction ?? 'pull',
      writeSourceLedger: options?.writeSourceLedger ?? false,
      localLedgerMode: options?.localLedgerMode ?? 'incremental',
      logger,
    });
  }

  async getSyncStatus(_projectId: string): Promise<SyncStatus> {
    return { isSyncing: false };
  }

  async loadLedgerFromVault(projectId: string): Promise<void> {
    const fs = await this.vaultService.getLocalClient(projectId);
    let ledger: SyncLedger;
    try {
      ledger = await buildLedgerFromFile(fs);
    } catch {
      ledger = await buildLedgerFromFs(fs);
    }
    this.ledgerCache.set(projectId, ledger);
    this.dirtyMap.delete(projectId);
  }

  async rebuildLedger(projectId: string): Promise<void> {
    const fs = await this.vaultService.getLocalClient(projectId);
    const ledger = await buildLedgerFromFs(fs);
    await writeLedger(fs, ledger);
    this.ledgerCache.set(projectId, ledger);
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
      const fs = await this.vaultService.getLocalClient(projectId);
      const ledger = await buildLedgerFromFs(fs);
      this.ledgerCache.set(projectId, ledger);
      return ledger;
    }

    const dirty = this.dirtyMap.get(projectId);
    if (!dirty || dirty.length === 0) return cached;

    const fs = await this.vaultService.getLocalClient(projectId);
    const updated = await applyDirtyEntries(fs, cached, dirty);
    this.dirtyMap.delete(projectId);
    this.ledgerCache.set(projectId, updated);
    return updated;
  }

  private async doSync(
    projectId: string,
    source: FsClient,
    options: SyncOptions & {
      writeSourceLedger: boolean;
      localLedgerMode: string;
      logger?: Logger;
    },
  ): Promise<SyncResult> {
    const direction = options.direction ?? 'both';
    const logger = options.logger;

    const localLedger =
      options.localLedgerMode === 'empty'
        ? buildEmptyLedger()
        : await this.buildIncrementalLedger(projectId);

    const sourceLedger = await buildSourceLedger(source);

    const session = resolve(localLedger, sourceLedger, direction);

    const localFs = await this.vaultService.getLocalClient(projectId);

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
      await this.callbacks?.onPullComplete?.(projectId);
    }

    const result: SyncResult = {
      pulled: execResult.pulled,
      pushed: execResult.pushed,
      conflicts: session.plan.conflicts,
      errors: execResult.errors,
    };

    const localNotes = Object.keys(localLedger.entities).length;
    const remoteNotes = Object.keys(sourceLedger.entities).length;

    logger?.log(
      result.errors.length > 0 ? 'error' : 'info',
      `sync(${direction}) pulled=${result.pulled} pushed=${result.pushed} conflicts=${result.conflicts} localNotes=${localNotes} remoteNotes=${remoteNotes}`,
      {
        direction,
        localNotes,
        remoteNotes,
        localMeta: Object.keys(localLedger.meta_files),
        remoteMeta: Object.keys(sourceLedger.meta_files),
        toPull: session.plan.toPull,
        toPush: session.plan.toPush,
        toDeleteLocal: session.plan.toDeleteLocal,
        toDeleteRemote: session.plan.toDeleteRemote,
        conflicts: session.plan.conflicts,
        errors: result.errors,
      },
    );

    return result;
  }
}
