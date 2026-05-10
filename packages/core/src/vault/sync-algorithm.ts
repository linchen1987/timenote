import { createSyncLedger, type SyncEntity, type SyncLedger } from '../spec/sync-ledger';

export type SyncDirection = 'both' | 'pull' | 'push';

export interface SyncPlan {
  toPull: string[];
  toPush: string[];
  toDeleteRemote: string[];
  toDeleteLocal: string[];
  conflicts: number;
}

export interface SyncSession {
  plan: SyncPlan;
  mergedLedger: SyncLedger;
}

export function resolve(
  localLedger: SyncLedger,
  remoteLedger: SyncLedger,
  direction: SyncDirection,
): SyncSession {
  const notePlan = compareEntities(localLedger.entities, remoteLedger.entities, direction);
  const metaPlan = compareEntities(localLedger.meta_files, remoteLedger.meta_files, direction);

  const plan: SyncPlan = {
    toPull: [...notePlan.toPull, ...metaPlan.toPull.map((mf) => `meta:${mf}`)],
    toPush: [...notePlan.toPush, ...metaPlan.toPush.map((mf) => `meta:${mf}`)],
    toDeleteLocal: [...notePlan.toDeleteLocal, ...metaPlan.toDeleteLocal.map((mf) => `meta:${mf}`)],
    toDeleteRemote: [
      ...notePlan.toDeleteRemote,
      ...metaPlan.toDeleteRemote.map((mf) => `meta:${mf}`),
    ],
    conflicts: notePlan.conflicts + metaPlan.conflicts,
  };

  const mergedEntities = mergeEntities(localLedger.entities, remoteLedger.entities, notePlan);
  const mergedMeta = mergeEntities(localLedger.meta_files, remoteLedger.meta_files, metaPlan);

  const mergedLedger = createSyncLedger(mergedEntities, mergedMeta);

  return { plan, mergedLedger };
}

export function compareEntities(
  localMap: Record<string, SyncEntity>,
  remoteMap: Record<string, SyncEntity>,
  direction: SyncDirection,
): SyncPlan {
  const toPull: string[] = [];
  const toPush: string[] = [];
  const toDeleteRemote: string[] = [];
  const toDeleteLocal: string[] = [];
  let conflicts = 0;

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
        conflicts++;
        if (local.u > remote.u) {
          if (direction !== 'pull') toPush.push(key);
        } else if (direction !== 'push') {
          toPull.push(key);
        }
      }
    } else if (localAlive && remoteTomb) {
      conflicts++;
      if (local.u > remote.u) {
        if (direction !== 'pull') toPush.push(key);
      } else if (direction !== 'push') {
        toDeleteLocal.push(key);
      }
    } else if (localTomb && remoteAlive) {
      conflicts++;
      if (local.u > remote.u) {
        if (direction !== 'pull') toDeleteRemote.push(key);
      } else if (direction !== 'push') {
        toPull.push(key);
      }
    }
  }

  return { toPull, toPush, toDeleteRemote, toDeleteLocal, conflicts };
}

export function mergeEntities(
  localMap: Record<string, SyncEntity>,
  remoteMap: Record<string, SyncEntity>,
  plan: SyncPlan,
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
