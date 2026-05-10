import { z } from 'zod';
import { IsoDateString } from './manifest';

/**
 * # sync-ledger.json — Sync State
 *
 * Path: .timenote/sync-ledger.json
 * Core: no | Syncable: no (written independently on each side after merge)
 * Rebuildable: yes — can be fully reconstructed from physical files + delete-log
 *
 * Estimation: 100k notes × 150B = 15MB raw, ~1.5MB gzipped.
 * At 100 notes/day, supports 30+ years.
 *
 * @example
 * {
 *   "version": 1,
 *   "entities": {
 *     "2026-04/20260425-112010-1234.md": { "h": "e10adc39...", "u": "2026-04-25T12:10:00Z" },
 *     "2026-04/20260425-112010-5678.md": { "d": true, "u": "2026-04-25T14:30:00Z" }
 *   },
 *   "meta_files": {
 *     "manifest.json": { "h": "hash_1", "u": "2026-04-20T00:00:00Z" }
 *   }
 * }
 */

export const SYNC_LEDGER_VERSION = 1 as const;

export const SyncEntitySchema = z.union([
  z.object({
    h: z.string(),
    u: IsoDateString,
  }),
  z.object({
    d: z.literal(true),
    u: IsoDateString,
  }),
]);

export type SyncEntity = z.infer<typeof SyncEntitySchema>;

export const SyncLedgerSchema = z.object({
  version: z.literal(SYNC_LEDGER_VERSION),
  entities: z.record(z.string(), SyncEntitySchema),
  meta_files: z.record(z.string(), SyncEntitySchema),
});

export type SyncLedger = z.infer<typeof SyncLedgerSchema>;

export function createEmptySyncLedger(): SyncLedger {
  return { version: SYNC_LEDGER_VERSION, entities: {}, meta_files: {} };
}

export function createSyncLedger(
  entities: Record<string, SyncEntity>,
  metaFiles: Record<string, SyncEntity>,
): SyncLedger {
  return { version: SYNC_LEDGER_VERSION, entities, meta_files: metaFiles };
}

export const SYNC_LEDGER_EXAMPLE = {
  version: SYNC_LEDGER_VERSION,
  entities: {
    '2026-04/20260425-112010-1234.md': {
      h: 'e10adc3949ba59abbe56e057f20f883e',
      u: '2026-04-25T12:10:00Z',
    },
    '2026-04/20260425-112010-5678.md': {
      d: true,
      u: '2026-04-25T14:30:00Z',
    },
  },
  meta_files: {
    'manifest.json': { h: 'hash_1', u: '2026-04-20T00:00:00Z' },
    'menu.json': { h: 'hash_2', u: '2026-04-26T00:00:00Z' },
  },
} satisfies SyncLedger;
