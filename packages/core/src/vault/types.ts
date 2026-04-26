import { z } from 'zod';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const IsoDateString = z.string().regex(ISO_DATE_RE);

export const NoteIdSchema = z
  .string()
  .regex(/^[0-9]{8}-[0-9]{6}-[0-9]{4}$/, 'Note ID must match YYYYMMDD-HHmmss-SSSR format');

export type NoteId = z.infer<typeof NoteIdSchema>;

export const VolumeNameSchema = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}$/, 'Volume name must match YYYY-MM format');

export type VolumeName = z.infer<typeof VolumeNameSchema>;

const NoteFilenameSchema = z
  .string()
  .regex(
    /^[0-9]{8}-[0-9]{6}-[0-9]{4}\.[a-zA-Z0-9]+$/,
    'Note filename must match YYYYMMDD-HHmmss-SSSR.ext',
  );

export const ManifestSchema = z.object({
  project_id: z.string().min(1),
  name: z.string().min(1),
  version: z.literal('1.0.0'),
  created_at: IsoDateString,
  updated_at: IsoDateString,
});

export type Manifest = z.infer<typeof ManifestSchema>;

const MenuItemSchema: z.ZodType<MenuItem> = z.lazy(() =>
  z.object({
    title: z.string(),
    type: z.enum(['note', 'search']),
    note_id: z.string().optional(),
    search: z.string().optional(),
    children: z.array(MenuItemSchema).optional(),
  }),
);

export interface MenuItem {
  title: string;
  type: 'note' | 'search';
  note_id?: string;
  search?: string;
  children?: MenuItem[];
}

export const MenuDataSchema = z.object({
  version: z.literal(1),
  items: z.array(MenuItemSchema),
});

export type MenuData = z.infer<typeof MenuDataSchema>;

export const DeleteLogSchema = z.object({
  version: z.literal(1),
  records: z.record(z.string(), IsoDateString),
});

export type DeleteLog = z.infer<typeof DeleteLogSchema>;

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
  version: z.literal(1),
  last_sync_time: IsoDateString,
  entities: z.record(z.string(), SyncEntitySchema),
  meta_files: z.record(z.string(), SyncEntitySchema),
});

export type SyncLedger = z.infer<typeof SyncLedgerSchema>;

export const NoteFrontmatterSchema = z
  .object({
    created_at: IsoDateString,
    updated_at: IsoDateString,
    _sync_u: IsoDateString.optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    title: z.union([z.string(), z.array(z.string())]).optional(),
    aliases: z.union([z.string(), z.array(z.string())]).optional(),
    alias: z.union([z.string(), z.array(z.string())]).optional(),
    type: z.string().optional(),
    deleted: z.boolean().optional(),
  })
  .passthrough();

export type NoteFrontmatter = z.infer<typeof NoteFrontmatterSchema>;

export const RuntimeMenuItemSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  order: z.number(),
  title: z.string(),
  type: z.enum(['note', 'search']),
  note_id: z.string().optional(),
  search: z.string().optional(),
});

export type RuntimeMenuItem = z.infer<typeof RuntimeMenuItemSchema>;

export const NoteIndexSchema = z.object({
  id: NoteIdSchema,
  title: z.string(),
  tags: z.array(z.string()),
  aliases: z.array(z.string()),
  created_at: z.number(),
  updated_at: z.number(),
});

export type NoteIndex = z.infer<typeof NoteIndexSchema>;

export { NoteFilenameSchema, IsoDateString };
