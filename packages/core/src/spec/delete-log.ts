import { z } from 'zod';
import { IsoDateString } from './manifest';

/**
 * # delete-log.json — Deletion Record
 *
 * Path: .timenote/delete-log.json
 * Core: yes | Syncable: yes
 *
 * Records note deletion timestamps. Used by sync to generate tombstone
 * entries in sync-ledger when the physical file no longer exists.
 *
 * @example
 * {
 *   "version": 1,
 *   "updated_at": "2026-04-26T10:00:00Z",
 *   "records": {
 *     "20260425-112010-1234": "2026-04-26T10:00:00Z"
 *   }
 * }
 */

export const DELETE_LOG_VERSION = 1 as const;

export const DeleteLogSchema = z.object({
  version: z.literal(DELETE_LOG_VERSION),
  updated_at: IsoDateString,
  records: z.record(z.string(), IsoDateString),
});

export type DeleteLog = z.infer<typeof DeleteLogSchema>;

export function createEmptyDeleteLog(updatedAt?: string): DeleteLog {
  const now = new Date().toISOString();
  return { version: DELETE_LOG_VERSION, updated_at: updatedAt ?? now, records: {} };
}

export const DELETE_LOG_EXAMPLE = {
  version: DELETE_LOG_VERSION,
  updated_at: '2026-04-26T11:30:00Z',
  records: {
    '20260425-112010-1234': '2026-04-26T10:00:00Z',
    '20260420-080000-5678': '2026-04-26T11:30:00Z',
  },
} satisfies DeleteLog;
