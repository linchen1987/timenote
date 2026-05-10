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

export const MANIFEST_VERSION = '1.0.0' as const;

export const ManifestSchema = z.object({
  project_id: z.string().min(1),
  name: z.string().min(1),
  version: z.literal(MANIFEST_VERSION),
  created_at: IsoDateString,
  updated_at: IsoDateString,
});

export type Manifest = z.infer<typeof ManifestSchema>;

export function createManifest(input: {
  project_id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}): Manifest {
  const now = new Date().toISOString();
  return {
    project_id: input.project_id,
    name: input.name,
    version: MANIFEST_VERSION,
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
  };
}

export const MANIFEST_EXAMPLE = {
  project_id: 'Bm1ic75uaq',
  name: 'My Notes',
  version: MANIFEST_VERSION,
  created_at: '2026-04-25T12:00:00Z',
  updated_at: '2026-04-25T12:00:00Z',
} satisfies Manifest;
