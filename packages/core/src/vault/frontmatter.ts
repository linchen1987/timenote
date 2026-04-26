import { dump, load } from 'js-yaml';
import { type NoteFrontmatter, NoteFrontmatterSchema } from './types';

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
