import {
  normalizeTags,
  type ParsedNote,
  parseNote,
  parseNoteSafe,
  serializeNote,
} from './frontmatter';
import { createIndexService, type IndexService } from './index-service';
import {
  generateNoteId,
  isValidNoteFilename,
  isValidVolumeName,
  noteIdFromFilename,
  notePath,
} from './note-id';
import { type SearchProvider, SimpleSearchProvider } from './search-provider';
import type { NoteFrontmatter, NoteIndex } from './types';
import type { VaultService } from './vault-service';

export interface VaultNoteService {
  createNote(projectId: string, content?: string): Promise<string>;
  getNote(projectId: string, noteId: string): Promise<ParsedNote | null>;
  updateNote(projectId: string, noteId: string, content: string): Promise<void>;
  deleteNote(projectId: string, noteId: string): Promise<void>;

  activateVault(projectId: string): Promise<void>;
  deactivateVault(): void;

  listNotes(options?: { limit?: number; offset?: number }): Promise<NoteIndex[]>;
  searchNotes(query: string): Promise<NoteIndex[]>;
  getNotesByTag(tag: string): Promise<NoteIndex[]>;
  getAllTags(): Promise<string[]>;
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

    const transport = this.vaultService.getOpfsTransport(projectId);
    await transport.write(notePath(noteId), raw);

    if (this.activeProjectId === projectId) {
      await this.indexService.indexNote(noteId, raw);
      this.searchProvider.add(noteId, body);
    }

    return noteId;
  }

  async getNote(projectId: string, noteId: string): Promise<ParsedNote | null> {
    const transport = this.vaultService.getOpfsTransport(projectId);
    const path = notePath(noteId);
    const exists = await transport.exists(path);
    if (!exists) return null;

    const raw = await transport.read(path);
    return parseNote(raw);
  }

  async updateNote(projectId: string, noteId: string, content: string): Promise<void> {
    const transport = this.vaultService.getOpfsTransport(projectId);
    const path = notePath(noteId);
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
    const transport = this.vaultService.getOpfsTransport(projectId);
    const path = notePath(noteId);
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
    await this.indexService.clearIndex();
    this.searchProvider.clear();

    const transport = this.vaultService.getOpfsTransport(projectId);
    const volumes = await transport.list('');

    for (const vol of volumes) {
      if (vol.type !== 'directory' || !isValidVolumeName(vol.basename)) continue;
      const items = await transport.list(vol.basename);
      for (const item of items) {
        if (item.type === 'file' && isValidNoteFilename(item.basename)) {
          const noteId = noteIdFromFilename(item.basename);
          if (!noteId) continue;

          const raw = await transport.read(`${vol.basename}/${item.basename}`);
          await this.indexService.indexNote(noteId, raw);

          const parsed = parseNoteSafe(raw);
          if (parsed) this.searchProvider.add(noteId, parsed.body);
        }
      }
    }

    this.activeProjectId = projectId;
  }

  deactivateVault(): void {
    this.indexService.clearIndex();
    this.searchProvider.clear();
    this.activeProjectId = null;
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

interface ParsedSearchQuery {
  tags: string[];
  textTerms: string[];
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const tags: string[] = [];
  const textTerms: string[] = [];
  const parts = query.trim().split(/\s+/).filter(Boolean);

  for (const part of parts) {
    if (part.startsWith('#') && part.length > 1) {
      tags.push(part.slice(1));
    } else if (part !== '#') {
      textTerms.push(part);
    }
  }

  return { tags, textTerms };
}

function extractTagsFromBody(body: string): string[] {
  const hashtagRegex = /#([\w\u4e00-\u9fa5]+)/g;
  const matches = body.matchAll(hashtagRegex);
  return Array.from(new Set(Array.from(matches).map((m) => m[1])));
}
