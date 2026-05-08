import { z } from 'zod';

/**
 * # manifest.json — Vault Identity
 *
 * Path: .timenote/manifest.json
 * Core: yes | Syncable: yes
 *
 * @example
 * {
 *   "project_id": "Bm1ic75uaq",
 *   "name": "My Notes",
 *   "version": "1.0.0",
 *   "created_at": "2026-04-25T12:00:00Z",
 *   "updated_at": "2026-04-25T12:00:00Z"
 * }
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export const IsoDateString = z.string().regex(ISO_DATE_RE);

export const ManifestSchema = z.object({
  project_id: z.string().min(1),
  name: z.string().min(1),
  version: z.literal('1.0.0'),
  created_at: IsoDateString,
  updated_at: IsoDateString,
});

export type Manifest = z.infer<typeof ManifestSchema>;

export const MANIFEST_EXAMPLE = {
  project_id: 'Bm1ic75uaq',
  name: 'My Notes',
  version: '1.0.0',
  created_at: '2026-04-25T12:00:00Z',
  updated_at: '2026-04-25T12:00:00Z',
} satisfies Manifest;
