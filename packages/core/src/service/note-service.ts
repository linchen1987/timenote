import type { NoteIndex } from '../provider/index-service';
import { createIndexService, type IndexService } from '../provider/index-service';
import { type SearchProvider, SimpleSearchProvider } from '../provider/search-provider';
import {
  type NoteFrontmatter,
  normalizeTags,
  type ParsedNote,
  parseNote,
  parseNoteSafe,
  serializeNote,
} from '../spec/note';
import { generateNoteId, noteIdFromFilename } from '../spec/note-id';
import { isNoteFileEntry, isVolumeEntry, noteFilePath } from '../spec/vault-layout';
import type { VaultService } from '../vault/vault-service';
import { extractTagsFromBody, parseSearchQuery } from './search-query';

export interface VaultNoteService {
  createNote(projectId: string, content?: string): Promise<string>;
  getNote(projectId: string, noteId: string): Promise<ParsedNote | null>;
  getBody(projectId: string, noteId: string): Promise<string>;
  getBodies(projectId: string, noteIds: string[]): Promise<Map<string, string>>;
  updateNote(projectId: string, noteId: string, content: string): Promise<void>;
  deleteNote(projectId: string, noteId: string): Promise<void>;

  activateVault(projectId: string): Promise<void>;
  deactivateVault(): void;
  rebuildIndex(projectId: string): Promise<void>;

  listNotes(options?: { limit?: number; offset?: number }): Promise<NoteIndex[]>;
  searchNotes(query: string): Promise<NoteIndex[]>;
  getNotesByTag(tag: string): Promise<NoteIndex[]>;
  getAllTags(): Promise<string[]>;
  getTagsWithCounts(): Promise<{ name: string; count: number }[]>;
  getNoteIndex(noteId: string): Promise<NoteIndex | undefined>;
}

export function createVaultNoteService(vaultService: VaultService): VaultNoteService {
  return new VaultNoteServiceImpl(vaultService, createIndexService(), new SimpleSearchProvider());
}

class VaultNoteServiceImpl implements VaultNoteService {
  private activeProjectId: string | null = null;

  constructor(
    private vaultService: VaultService,
    private indexService: IndexService,
    private searchProvider: SearchProvider,
  ) {}

  async createNote(projectId: string, content?: string): Promise<string> {
    const noteId = generateNoteId();
    const now = new Date().toISOString();
    const body = content ?? '';
    const extractedTags = extractTagsFromBody(body);
    const fm: NoteFrontmatter = {
      created_at: now,
      updated_at: now,
      ...(extractedTags.length > 0 ? { tags: extractedTags } : {}),
    };
    const raw = serializeNote(fm, body);

    const transport = this.vaultService.getTransport(projectId);
    await transport.write(noteFilePath(noteId), raw);

    if (this.activeProjectId === projectId) {
      await this.indexService.indexNote(noteId, raw);
      this.searchProvider.add(noteId, body);
    }

    return noteId;
  }

  async getNote(projectId: string, noteId: string): Promise<ParsedNote | null> {
    const transport = this.vaultService.getTransport(projectId);
    const path = noteFilePath(noteId);
    const exists = await transport.exists(path);
    if (!exists) return null;

    const raw = await transport.read(path);
    return parseNote(raw);
  }

  async getBody(projectId: string, noteId: string): Promise<string> {
    const cached = await this.indexService.getBody(noteId);
    if (cached !== undefined) return cached;

    const transport = this.vaultService.getTransport(projectId);
    const path = noteFilePath(noteId);
    const exists = await transport.exists(path);
    if (!exists) return '';

    const raw = await transport.read(path);
    const parsed = parseNoteSafe(raw);
    return parsed?.body ?? '';
  }

  async getBodies(projectId: string, noteIds: string[]): Promise<Map<string, string>> {
    const cached = await this.indexService.getBodies(noteIds);
    if (cached.size === noteIds.length) return cached;

    const missing = noteIds.filter((id) => !cached.has(id));
    const transport = this.vaultService.getTransport(projectId);
    for (const id of missing) {
      const path = noteFilePath(id);
      const exists = await transport.exists(path);
      if (!exists) continue;
      const raw = await transport.read(path);
      const parsed = parseNoteSafe(raw);
      if (parsed) cached.set(id, parsed.body);
    }
    return cached;
  }

  async updateNote(projectId: string, noteId: string, content: string): Promise<void> {
    const transport = this.vaultService.getTransport(projectId);
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

    if (this.activeProjectId === projectId) {
      await this.indexService.indexNote(noteId, raw);
      this.searchProvider.update(noteId, content);
    }
  }

  async deleteNote(projectId: string, noteId: string): Promise<void> {
    const transport = this.vaultService.getTransport(projectId);
    const path = noteFilePath(noteId);
    const exists = await transport.exists(path);
    if (!exists) return;

    await transport.remove(path);
    await this.vaultService.appendDeleteLog(projectId, noteId);

    if (this.activeProjectId === projectId) {
      await this.indexService.removeNoteIndex(noteId);
      this.searchProvider.remove(noteId);
    }
  }

  async activateVault(projectId: string): Promise<void> {
    const existingIds = await this.indexService.getAllNoteIds();

    if (existingIds.size > 0) {
      const bodies = await this.indexService.getAllBodies();
      for (const [id, body] of bodies) {
        this.searchProvider.add(id, body);
      }
    }

    const transport = this.vaultService.getTransport(projectId);
    const volumes = await transport.list('');

    const opfsNoteIds = new Set<string>();
    const notesToProcess: Array<{ noteId: string; path: string }> = [];

    for (const vol of volumes) {
      if (!isVolumeEntry(vol)) continue;
      const items = await transport.list(vol.basename);
      for (const item of items) {
        if (isNoteFileEntry(item)) {
          const noteId = noteIdFromFilename(item.basename);
          if (!noteId) continue;
          opfsNoteIds.add(noteId);

          if (!existingIds.has(noteId)) {
            notesToProcess.push({ noteId, path: `${vol.basename}/${item.basename}` });
          }
        }
      }
    }

    for (const id of existingIds) {
      if (!opfsNoteIds.has(id)) {
        await this.indexService.removeNoteIndex(id);
        this.searchProvider.remove(id);
      }
    }

    const CONCURRENCY = 8;
    for (let i = 0; i < notesToProcess.length; i += CONCURRENCY) {
      const batch = notesToProcess.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async ({ noteId, path }) => {
          const raw = await transport.read(path);
          await this.indexService.indexNote(noteId, raw);
          const parsed = parseNoteSafe(raw);
          if (parsed) this.searchProvider.add(noteId, parsed.body);
        }),
      );
    }

    this.activeProjectId = projectId;
  }

  deactivateVault(): void {
    this.indexService.clearIndex();
    this.searchProvider.clear();
    this.activeProjectId = null;
  }

  async rebuildIndex(projectId: string): Promise<void> {
    this.indexService.clearIndex();
    this.searchProvider.clear();
    this.activeProjectId = null;
    await this.activateVault(projectId);
  }

  async listNotes(options?: { limit?: number; offset?: number }): Promise<NoteIndex[]> {
    this.ensureActive();
    return this.indexService.getTimeline(options?.limit, options?.offset);
  }

  async searchNotes(query: string): Promise<NoteIndex[]> {
    this.ensureActive();
    const parsed = parseSearchQuery(query);

    let candidateIds: Set<string> | null = null;

    if (parsed.tags.length > 0) {
      for (const tag of parsed.tags) {
        const notesByTag = await this.indexService.getNotesByTag(tag);
        const ids = new Set(notesByTag.map((n) => n.id));
        candidateIds = candidateIds ? new Set([...candidateIds].filter((id) => ids.has(id))) : ids;
      }
    }

    let searchResults: Map<string, number> | null = null;
    if (parsed.textTerms.length > 0) {
      const results = this.searchProvider.search(parsed.textTerms);
      searchResults = new Map(results.map((r) => [r.id, r.score]));
    }

    let finalIds: string[];
    if (candidateIds && searchResults) {
      finalIds = [...candidateIds].filter((id) => searchResults?.has(id));
      finalIds.sort((a, b) => (searchResults?.get(b) ?? 0) - (searchResults?.get(a) ?? 0));
    } else if (searchResults) {
      finalIds = [...searchResults.keys()];
    } else if (candidateIds) {
      finalIds = [...candidateIds];
    } else {
      return this.indexService.getTimeline(50, 0);
    }

    const indexes: NoteIndex[] = [];
    for (const id of finalIds) {
      const idx = await this.indexService.getIndex(id);
      if (idx) indexes.push(idx);
    }

    return indexes;
  }

  async getNotesByTag(tag: string): Promise<NoteIndex[]> {
    this.ensureActive();
    return this.indexService.getNotesByTag(tag);
  }

  async getAllTags(): Promise<string[]> {
    this.ensureActive();
    return this.indexService.getAllTags();
  }

  async getTagsWithCounts(): Promise<{ name: string; count: number }[]> {
    this.ensureActive();
    return this.indexService.getTagsWithCounts();
  }

  async getNoteIndex(noteId: string): Promise<NoteIndex | undefined> {
    this.ensureActive();
    return this.indexService.getIndex(noteId);
  }

  private ensureActive(): void {
    if (!this.activeProjectId) {
      throw new Error('No active vault. Call activateVault() first.');
    }
  }
}

export { parseSearchQuery };
