import Dexie, { type Table } from 'dexie';
import { normalizeAliases, normalizeTags, normalizeTitle, parseNoteSafe } from './frontmatter';
import type { NoteIndex } from './types';

interface NoteBody {
  id: string;
  body: string;
}

class VaultIndexDB extends Dexie {
  notes!: Table<NoteIndex>;
  bodies!: Table<NoteBody>;

  constructor() {
    super('TimenoteVaultIndex');
    this.version(1).stores({
      notes: 'id, title, updated_at, created_at, *tags',
    });
    this.version(2).stores({
      notes: 'id, title, updated_at, created_at, *tags',
      bodies: 'id',
    });
  }
}

export interface IndexService {
  indexNote(noteId: string, rawContent: string): Promise<void>;
  removeNoteIndex(noteId: string): Promise<void>;
  clearIndex(): Promise<void>;
  getTimeline(limit?: number, offset?: number): Promise<NoteIndex[]>;
  getNotesByTag(tag: string): Promise<NoteIndex[]>;
  getAllTags(): Promise<string[]>;
  getIndex(noteId: string): Promise<NoteIndex | undefined>;
  getAllNoteIds(): Promise<Set<string>>;
  getAllBodies(): Promise<Map<string, string>>;
}

export function createIndexService(): IndexService {
  return new IndexServiceImpl();
}

class IndexServiceImpl implements IndexService {
  private db = new VaultIndexDB();

  async indexNote(noteId: string, rawContent: string): Promise<void> {
    const parsed = parseNoteSafe(rawContent);
    if (!parsed) return;

    const fm = parsed.frontmatter;
    const index: NoteIndex = {
      id: noteId,
      title: normalizeTitle(fm.title),
      tags: normalizeTags(fm.tags),
      aliases: normalizeAliases(fm.title, fm.aliases, fm.alias),
      created_at: new Date(fm.created_at).getTime(),
      updated_at: new Date(fm.updated_at).getTime(),
    };

    await this.db.notes.put(index);
    await this.db.bodies.put({ id: noteId, body: parsed.body });
  }

  async removeNoteIndex(noteId: string): Promise<void> {
    await this.db.notes.delete(noteId);
    await this.db.bodies.delete(noteId);
  }

  async clearIndex(): Promise<void> {
    await this.db.notes.clear();
    await this.db.bodies.clear();
  }

  async getTimeline(limit = 50, offset = 0): Promise<NoteIndex[]> {
    return this.db.notes.orderBy('updated_at').reverse().offset(offset).limit(limit).toArray();
  }

  async getNotesByTag(tag: string): Promise<NoteIndex[]> {
    const lower = tag.toLowerCase();
    const all = await this.db.notes.toArray();
    return all.filter((note) => note.tags.some((t) => t.toLowerCase() === lower));
  }

  async getAllTags(): Promise<string[]> {
    const all = await this.db.notes.toArray();
    const tagSet = new Set<string>();
    for (const note of all) {
      for (const tag of note.tags) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
  }

  async getIndex(noteId: string): Promise<NoteIndex | undefined> {
    return this.db.notes.get(noteId);
  }

  async getAllNoteIds(): Promise<Set<string>> {
    const all = await this.db.notes.toArray();
    return new Set(all.map((n) => n.id));
  }

  async getAllBodies(): Promise<Map<string, string>> {
    const all = await this.db.bodies.toArray();
    return new Map(all.map((b) => [b.id, b.body]));
  }
}
