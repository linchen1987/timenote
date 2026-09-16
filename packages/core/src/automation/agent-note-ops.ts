import { extractTagsFromBody } from '../notes/search-query';
import { computeContentHash } from '../spec/hash';
import {
  type AttachmentRef,
  type NoteFrontmatter,
  normalizeAliases,
  normalizeTags,
  normalizeTitle,
  type ParsedNote,
  parseNote,
  serializeNote,
} from '../spec/note';
import { generateNoteId } from '../spec/note-id';
import { noteFilePath } from '../spec/vault-layout';
import { AutomationOperationError } from './contracts';

/**
 * Revision-aware note operations for automation (agent) access.
 * revision = `sha256:<hex>` over the full raw note file content, so it changes
 * with any persisted edit. Writers must pass expectedRevision (CAS) for
 * update/delete; conflicts are surfaced as REVISION_CONFLICT with the current
 * revision instead of silently overwriting.
 */

export interface AgentNoteTransport {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface NoteSnapshot {
  noteId: string;
  raw: string;
  revision: string;
  frontmatter: NoteFrontmatter;
  title: string;
  body: string;
  tags: string[];
  aliases: string[];
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentRef[];
}

export async function computeNoteRevision(raw: string): Promise<string> {
  return `sha256:${await computeContentHash(raw)}`;
}

function snapshotFromRaw(
  noteId: string,
  raw: string,
  revision: string,
  parsed: ParsedNote,
): NoteSnapshot {
  const fm = parsed.frontmatter;
  return {
    noteId,
    raw,
    revision,
    frontmatter: fm,
    title: normalizeTitle(fm.title, fm.titles),
    body: parsed.body,
    tags: normalizeTags(fm.tags),
    aliases: normalizeAliases(fm.title, fm.titles, fm.aliases, fm.alias),
    createdAt: fm.created_at,
    updatedAt: fm.updated_at,
    attachments: fm.attachments ?? [],
  };
}

export async function readNoteSnapshot(
  transport: AgentNoteTransport,
  noteId: string,
): Promise<NoteSnapshot | null> {
  const path = noteFilePath(noteId);
  if (!(await transport.exists(path))) return null;
  const raw = await transport.read(path);
  const parsed = parseNote(raw);
  const revision = await computeNoteRevision(raw);
  return snapshotFromRaw(noteId, raw, revision, parsed);
}

function buildCreateFrontmatter(content: string): NoteFrontmatter {
  const now = new Date().toISOString();
  const extractedTags = extractTagsFromBody(content);
  return {
    created_at: now,
    updated_at: now,
    ...(extractedTags.length > 0 ? { tags: extractedTags } : {}),
  };
}

export interface CreateGuardedResult {
  noteId: string;
  raw: string;
  revision: string;
}

export interface CreateNoteOptions {
  /** Pre-allocated note id (prepare journal) — used for crash-safe
   * idempotent re-execution of create operations. */
  noteId?: string;
  /** With a pre-allocated id: an existing note is treated as this
   * operation's earlier committed write and its revision is returned. */
  idempotent?: boolean;
}

export async function createNoteGuarded(
  transport: AgentNoteTransport,
  content: string,
  options?: CreateNoteOptions,
): Promise<CreateGuardedResult> {
  let noteId = options?.noteId;
  if (noteId) {
    const path = noteFilePath(noteId);
    if (await transport.exists(path)) {
      if (options?.idempotent) {
        // crash-recovery replay: the write landed before the response was
        // recorded; report the committed state instead of duplicating
        const raw = await transport.read(path);
        return { noteId, raw, revision: await computeNoteRevision(raw) };
      }
      throw new AutomationOperationError('INVALID_ARGUMENT', `note id collision: ${noteId}`);
    }
  } else {
    noteId = generateNoteId();
  }
  const raw = serializeNote(buildCreateFrontmatter(content), content);
  await transport.write(noteFilePath(noteId), raw);
  return { noteId, raw, revision: await computeNoteRevision(raw) };
}

export interface UpdateNoteInput {
  content?: string;
  append?: string;
}

export interface UpdateGuardedResult {
  raw: string;
  revision: string;
  body: string;
}

export async function updateNoteGuarded(
  transport: AgentNoteTransport,
  noteId: string,
  update: UpdateNoteInput,
  expectedRevision: string,
): Promise<UpdateGuardedResult> {
  if (update.content === undefined && update.append === undefined) {
    throw new AutomationOperationError('INVALID_ARGUMENT', 'content or append is required');
  }

  const snapshot = await readNoteSnapshot(transport, noteId);
  if (!snapshot) {
    throw new AutomationOperationError('NOTE_NOT_FOUND', `Note not found: ${noteId}`);
  }
  if (snapshot.revision !== expectedRevision) {
    throw new AutomationOperationError('REVISION_CONFLICT', `Note ${noteId} changed since read`, {
      details: { currentRevision: snapshot.revision, expectedRevision },
    });
  }

  const body =
    update.content !== undefined
      ? update.content
      : update.append !== undefined
        ? snapshot.body + update.append
        : snapshot.body;

  const now = new Date().toISOString();
  const extractedTags = extractTagsFromBody(body);
  const existingTags = normalizeTags(snapshot.tags);
  const mergedTags = [...new Set([...existingTags, ...extractedTags])];
  // Preserve unknown/typed frontmatter fields; only updated_at and tags are rewritten.
  const updatedFm: NoteFrontmatter = {
    ...snapshot.frontmatter,
    updated_at: now,
    ...(mergedTags.length > 0 ? { tags: mergedTags } : {}),
  };
  const raw = serializeNote(updatedFm, body);
  await transport.write(noteFilePath(noteId), raw);
  const revision = await computeNoteRevision(raw);
  return { raw, revision, body };
}

/**
 * Delete with CAS. The delete-log tombstone is written before the file removal:
 * a crash between the two steps leaves a tombstone + file, which sync resolves
 * as a deletion, instead of a removed file without a tombstone that would be
 * resurrected by the next pull.
 */
export async function deleteNoteGuarded(
  transport: AgentNoteTransport,
  appendDeleteLog: (noteId: string) => Promise<void>,
  noteId: string,
  expectedRevision: string,
): Promise<void> {
  const snapshot = await readNoteSnapshot(transport, noteId);
  if (!snapshot) {
    throw new AutomationOperationError('NOTE_NOT_FOUND', `Note not found: ${noteId}`);
  }
  if (snapshot.revision !== expectedRevision) {
    throw new AutomationOperationError('REVISION_CONFLICT', `Note ${noteId} changed since read`, {
      details: { currentRevision: snapshot.revision, expectedRevision },
    });
  }
  await appendDeleteLog(noteId);
  await transport.remove(noteFilePath(noteId));
}
