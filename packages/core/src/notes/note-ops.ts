import { type NoteFrontmatter, normalizeTags, parseNote, serializeNote } from '../spec/note';
import { generateNoteId } from '../spec/note-id';
import { noteFilePath } from '../spec/vault-layout';
import { extractTagsFromBody } from './search-query';

interface NoteTransport {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export async function createNoteOp(
  transport: Pick<NoteTransport, 'write'>,
  content: string,
): Promise<string> {
  const noteId = generateNoteId();
  const now = new Date().toISOString();
  const extractedTags = extractTagsFromBody(content);
  const fm: NoteFrontmatter = {
    created_at: now,
    updated_at: now,
    ...(extractedTags.length > 0 ? { tags: extractedTags } : {}),
  };
  const raw = serializeNote(fm, content);
  await transport.write(noteFilePath(noteId), raw);
  return noteId;
}

export async function updateNoteOp(
  transport: Pick<NoteTransport, 'read' | 'write' | 'exists'>,
  noteId: string,
  content: string,
): Promise<void> {
  const path = noteFilePath(noteId);
  const exists = await transport.exists(path);
  if (!exists) throw new Error(`Note not found: ${noteId}`);

  const existing = parseNote(await transport.read(path));
  const now = new Date().toISOString();
  const extractedTags = extractTagsFromBody(content);
  const existingTags = normalizeTags(existing.frontmatter.tags);
  const mergedTags = [...new Set([...existingTags, ...extractedTags])];
  const updatedFm: NoteFrontmatter = {
    ...existing.frontmatter,
    updated_at: now,
    ...(mergedTags.length > 0 ? { tags: mergedTags } : {}),
  };
  const raw = serializeNote(updatedFm, content);
  await transport.write(path, raw);
}

export async function deleteNoteOp(
  transport: Pick<NoteTransport, 'read' | 'remove' | 'exists'>,
  appendDeleteLog: (noteId: string) => Promise<void>,
  noteId: string,
): Promise<void> {
  const path = noteFilePath(noteId);
  const exists = await transport.exists(path);
  if (!exists) return;

  await transport.remove(path);
  await appendDeleteLog(noteId);
}
