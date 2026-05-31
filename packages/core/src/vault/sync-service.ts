import type { FsProvider } from '../fs/provider';
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
  sync(projectId: string, remote: FsProvider): Promise<SyncResult>;
  pull(projectId: string, remote: FsProvider): Promise<SyncResult>;
  push(projectId: string, remote: FsProvider): Promise<SyncResult>;
  initFromSource(
    projectId: string,
    source: FsProvider,
    options?: { writeSourceLedger?: boolean },
  ): Promise<SyncResult>;
  syncWithSource(projectId: string, source: FsProvider, options?: SyncOptions): Promise<SyncResult>;
  getSyncStatus(projectId: string): Promise<SyncStatus>;
  loadLedgerCache(projectId: string): Promise<void>;
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

async function buildSourceLedger(source: FsProvider): Promise<SyncLedger> {
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

  async sync(projectId: string, remote: FsProvider): Promise<SyncResult> {
    return this.doSync(projectId, remote, {
      direction: 'both',
      writeSourceLedger: true,
      localLedgerMode: 'incremental',
    });
  }

  async pull(projectId: string, remote: FsProvider): Promise<SyncResult> {
    return this.doSync(projectId, remote, {
      direction: 'pull',
      writeSourceLedger: true,
      localLedgerMode: 'incremental',
    });
  }

  async push(projectId: string, remote: FsProvider): Promise<SyncResult> {
    return this.doSync(projectId, remote, {
      direction: 'push',
      writeSourceLedger: true,
      localLedgerMode: 'incremental',
    });
  }

  async initFromSource(
    projectId: string,
    source: FsProvider,
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
    source: FsProvider,
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
      const fs = await this.vaultService.getProvider(projectId);
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
      const fs = await this.vaultService.getProvider(projectId);
      const ledger = await buildLedgerFromFs(fs);
      this.ledgerCache.set(projectId, ledger);
      return ledger;
    }

    const dirty = this.dirtyMap.get(projectId);
    if (!dirty || dirty.length === 0) return cached;

    const fs = await this.vaultService.getProvider(projectId);
    const updated = await applyDirtyEntries(fs, cached, dirty);
    this.dirtyMap.delete(projectId);
    this.ledgerCache.set(projectId, updated);
    return updated;
  }

  private async doSync(
    projectId: string,
    source: FsProvider,
    options: SyncOptions & { writeSourceLedger: boolean; localLedgerMode: string },
  ): Promise<SyncResult> {
    const direction = options.direction ?? 'both';

    const localLedger =
      options.localLedgerMode === 'empty'
        ? buildEmptyLedger()
        : await this.buildIncrementalLedger(projectId);

    const sourceLedger = await buildSourceLedger(source);

    const session = resolve(localLedger, sourceLedger, direction);

    const localFs = await this.vaultService.getProvider(projectId);

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

    return {
      pulled: execResult.pulled,
      pushed: execResult.pushed,
      conflicts: session.plan.conflicts,
      errors: execResult.errors,
    };
  }
}
