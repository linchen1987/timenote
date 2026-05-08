import { dump, load } from 'js-yaml';
import { z } from 'zod';
import { IsoDateString } from './manifest';

/**
 * # Note File — YAML Frontmatter + Markdown Body
 *
 * Path: {YYYY-MM}/{YYYYMMDD-HHmmss-SSSR}.md
 * Core: yes (physical file = single source of truth)
 *
 * Volume pattern:  ^[0-9]{4}-[0-9]{2}$                        (e.g. "2026-04")
 * Note ID pattern: ^[0-9]{8}-[0-9]{6}-[0-9]{4}$               (e.g. "20260425-121000-0457")
 * Filename pattern: ^[0-9]{8}-[0-9]{6}-[0-9]{4}\\.[a-zA-Z0-9]+$ (e.g. "20260425-121000-0457.md")
 *
 * @example
 * ---
 * created_at: "2026-04-25T13:00:00Z"
 * updated_at: "2026-04-25T12:10:00Z"
 * _sync_u: "2026-04-25T12:10:00Z"
 * tags: [tag1, tag2]
 * title: "Note Title"
 * aliases: ["alias"]
 * type: markdown
 * ---
 * Note body here
 */

// ─── ID & Filename Schemas ──────────────────────────────────

export const NoteIdSchema = z
  .string()
  .regex(/^[0-9]{8}-[0-9]{6}-[0-9]{4}$/, 'Note ID must match YYYYMMDD-HHmmss-SSSR format');

export type NoteId = z.infer<typeof NoteIdSchema>;

export const VolumeNameSchema = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}$/, 'Volume name must match YYYY-MM format');

export type VolumeName = z.infer<typeof VolumeNameSchema>;

export const NoteFilenameSchema = z
  .string()
  .regex(
    /^[0-9]{8}-[0-9]{6}-[0-9]{4}\.[a-zA-Z0-9]+$/,
    'Note filename must match YYYYMMDD-HHmmss-SSSR.ext',
  );

// ─── Frontmatter Schema ─────────────────────────────────────

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

export const NOTE_EXAMPLE: NoteFrontmatter = {
  created_at: '2026-04-25T13:00:00Z',
  updated_at: '2026-04-25T12:10:00Z',
  tags: ['tag1', 'tag2'],
  title: 'Note Title',
  aliases: ['alias'],
  type: 'markdown',
};

// ─── Parse & Serialize ──────────────────────────────────────

export interface ParsedNote {
  frontmatter: NoteFrontmatter;
  body: string;
  raw: string;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function splitFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const match = raw.match(FM_RE);
  if (!match) return { data: {}, content: raw };
  const parsed = load(match[1]) as Record<string, unknown>;
  const content = raw.slice(match[0].length);
  return { data: parsed ?? {}, content };
}

export function parseNote(rawContent: string): ParsedNote {
  const { data, content } = splitFrontmatter(rawContent);
  const frontmatter = NoteFrontmatterSchema.parse(preprocessDates(data));
  return { frontmatter, body: content, raw: rawContent };
}

export function parseNoteSafe(rawContent: string): ParsedNote | null {
  try {
    return parseNote(rawContent);
  } catch {
    return null;
  }
}

export function serializeNote(frontmatter: NoteFrontmatter, body: string): string {
  const sorted = sortFrontmatter(frontmatter);
  const yaml = dump(sorted, { lineWidth: -1, quotingType: "'" });
  return `---\n${yaml}---\n${body}`;
}

// ─── Normalize Helpers ──────────────────────────────────────

export function normalizeTags(tags?: string | string[]): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return [tags];
}

export function normalizeTitle(title?: string | string[]): string {
  if (!title) return '';
  if (Array.isArray(title)) return title[0] ?? '';
  return title;
}

export function normalizeAliases(
  title?: string | string[],
  aliases?: string | string[],
  alias?: string | string[],
): string[] {
  const allTitles = normalizeArray(title);
  const allAliases = normalizeArray(aliases);
  const allAlias = normalizeArray(alias);
  const merged = [...allTitles, ...allAliases, ...allAlias];
  return [...new Set(merged)];
}

function normalizeArray(value?: string | string[]): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
}

// ─── Internal Helpers ───────────────────────────────────────

function preprocessDates(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = value instanceof Date ? value.toISOString() : value;
  }
  return result;
}

type FrontmatterKey =
  | 'created_at'
  | 'updated_at'
  | '_sync_u'
  | 'tags'
  | 'title'
  | 'aliases'
  | 'alias'
  | 'type'
  | 'deleted';

const KEY_ORDER: FrontmatterKey[] = [
  'created_at',
  'updated_at',
  '_sync_u',
  'tags',
  'title',
  'aliases',
  'alias',
  'type',
  'deleted',
];

function sortFrontmatter(fm: NoteFrontmatter): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fm)) {
    if (KEY_ORDER.includes(key as FrontmatterKey)) {
      continue;
    }
    rest[key] = value;
  }

  for (const key of KEY_ORDER) {
    if (key in fm) {
      sorted[key] = fm[key as keyof NoteFrontmatter];
    }
  }

  return { ...sorted, ...rest };
}
