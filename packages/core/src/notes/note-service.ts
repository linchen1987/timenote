import {
  type CreateNoteOptions,
  computeNoteRevision,
  createNoteGuarded,
  deleteNoteGuarded,
  type NoteSnapshot,
  readNoteSnapshot,
  type UpdateNoteInput,
  updateNoteGuarded,
} from '../automation/agent-note-ops';
import { createMutationQueue, type MutationQueue } from '../automation/mutation-queue';
import { AutomationOperationError } from '../automation/contracts';
import {
  type AttachmentRef,
  type NoteFrontmatter,
  normalizeTags,
  type ParsedNote,
  parseNote,
  parseNoteSafe,
  serializeNote,
} from '../spec/note';
import { noteIdFromFilename } from '../spec/note-id';
import { isNoteFileEntry, isVolumeEntry, noteFilePath } from '../spec/vault-layout';
import type { VaultService } from '../vault/vault-service';
import { type AttachmentService, createAttachmentService } from './attachment-service';
import type { NoteIndex } from './index-service';
import { createIndexService, type IndexService } from './index-service';
import { createNoteOp, deleteNoteOp, updateNoteOp } from './note-ops';
import { type SearchProvider, SimpleSearchProvider } from './search-provider';
import { extractTagsFromBody, parseSearchQuery } from './search-query';

export interface StagedAttachment {
  type: 'existing';
  path: string;
  name?: string;
  mime?: string;
  size?: number;
}

export interface PendingAttachment {
  type: 'pending';
  path: string;
  data: ArrayBuffer;
  name: string;
  mime?: string;
  size: number;
}

export type EditAttachment = StagedAttachment | PendingAttachment;

export interface SaveNoteOptions {
  body: string;
  attachments: EditAttachment[];
  removedPaths: string[];
  /** CAS guard: revision of the note this edit started from. Rejects with
   * REVISION_CONFLICT when the file changed in the meantime (e.g. an agent
   * edit) instead of silently overwriting the newer version. */
  expectedRevision?: string;
}

export interface ListNotesOptions {
  limit?: number;
  offset?: number;
  updatedAfter?: number;
  updatedBefore?: number;
}

export interface GuardedWriteResult {
  revision: string;
}

export interface VaultNoteService {
  createNote(projectId: string, content?: string): Promise<string>;
  getNote(projectId: string, noteId: string): Promise<ParsedNote | null>;
  getNoteSnapshot(projectId: string, noteId: string): Promise<NoteSnapshot | null>;
  getBody(projectId: string, noteId: string): Promise<string>;
  getBodies(projectId: string, noteIds: string[]): Promise<Map<string, string>>;
  updateNote(projectId: string, noteId: string, content: string): Promise<void>;
  deleteNote(projectId: string, noteId: string): Promise<void>;
  saveNoteWithAttachments(
    projectId: string,
    noteId: string,
    options: SaveNoteOptions,
  ): Promise<void>;

  createNoteGuarded(
    projectId: string,
    content: string,
    options?: CreateNoteOptions,
  ): Promise<{ noteId: string } & GuardedWriteResult>;
  updateNoteGuarded(
    projectId: string,
    noteId: string,
    update: UpdateNoteInput,
    expectedRevision: string,
  ): Promise<GuardedWriteResult>;
  deleteNoteGuarded(projectId: string, noteId: string, expectedRevision: string): Promise<void>;

  /** Apply an externally-modified note (raw file watcher path): read final
   * file state, refresh index/search when it differs, report the outcome. */
  applyExternalChange(
    projectId: string,
    noteId: string,
  ): Promise<'changed' | 'deleted' | 'unchanged' | 'invalid' | 'inactive'>;
  /** Scan all note files and reconcile index/search with disk state;
   * returns ids whose content changed (covers edits made while closed). */
  reconcileVault(projectId: string): Promise<string[]>;

  activateVault(projectId: string): Promise<void>;
  deactivateVault(): void;
  rebuildIndex(projectId: string): Promise<void>;

  listNotes(options?: ListNotesOptions): Promise<NoteIndex[]>;
  countNotes(): Promise<number>;
  searchNotes(query: string): Promise<NoteIndex[]>;
  getNotesByTag(tag: string): Promise<NoteIndex[]>;
  getAllTags(): Promise<string[]>;
  getTagsWithCounts(): Promise<{ name: string; count: number }[]>;
  getNoteIndex(noteId: string): Promise<NoteIndex | undefined>;

  getAttachmentService(projectId: string): Promise<AttachmentService>;
  getAttachmentBlob(projectId: string, path: string): Promise<ArrayBuffer>;
  garbageCollectAttachments(projectId: string): Promise<number>;
}

export interface NoteServiceCallbacks {
  onDeleteNote?: (projectId: string, noteId: string) => Promise<void>;
}

export interface NoteServiceOptions {
  /** Shared per-vault mutation queue; supply the orchestrator's queue so note
   * writes, sync applies and migrations serialize on the same critical
   * section. Defaults to a private queue. */
  queue?: MutationQueue;
}

export function createVaultNoteService(
  vaultService: VaultService,
  callbacks?: NoteServiceCallbacks,
  options?: NoteServiceOptions,
): VaultNoteService {
  return new VaultNoteServiceImpl(vaultService, callbacks, options);
}

class VaultNoteServiceImpl implements VaultNoteService {
  private activeProjectId: string | null = null;
  private indexService: IndexService | null = null;
  private searchProvider: SearchProvider = new SimpleSearchProvider();
  private mutationQueue: MutationQueue;

  constructor(
    private vaultService: VaultService,
    callbacks?: NoteServiceCallbacks,
    options?: NoteServiceOptions,
  ) {
    this.callbacks = callbacks;
    this.mutationQueue = options?.queue ?? createMutationQueue();
  }

  private callbacks?: NoteServiceCallbacks;

  private get idx(): IndexService {
    if (!this.indexService) throw new Error('No active vault. Call activateVault() first.');
    return this.indexService;
  }

  async createNote(projectId: string, content?: string): Promise<string> {
    return this.mutationQueue.run(projectId, async () => {
      const transport = await this.vaultService.getLocalClient(projectId);
      const body = content ?? '';
      const noteId = await createNoteOp(transport, body);

      if (this.activeProjectId === projectId && this.indexService) {
        const path = noteFilePath(noteId);
        const raw = await transport.read(path);
        await this.indexService.indexNote(noteId, raw);
        this.searchProvider.add(noteId, body);
      }

      return noteId;
    });
  }

  async getNote(projectId: string, noteId: string): Promise<ParsedNote | null> {
    const transport = await this.vaultService.getLocalClient(projectId);
    const path = noteFilePath(noteId);
    const exists = await transport.exists(path);
    if (!exists) return null;

    const raw = await transport.read(path);
    return parseNote(raw);
  }

  async getNoteSnapshot(projectId: string, noteId: string): Promise<NoteSnapshot | null> {
    const transport = await this.vaultService.getLocalClient(projectId);
    return readNoteSnapshot(transport, noteId);
  }

  async getBody(projectId: string, noteId: string): Promise<string> {
    // the body cache belongs to the active vault; serving it for another
    // projectId would leak project A's content into project B's reads
    if (this.indexService && this.activeProjectId === projectId) {
      const cached = await this.indexService.getBody(noteId);
      if (cached !== undefined) return cached;
    }

    const transport = await this.vaultService.getLocalClient(projectId);
    const path = noteFilePath(noteId);
    const exists = await transport.exists(path);
    if (!exists) return '';

    const raw = await transport.read(path);
    const parsed = parseNoteSafe(raw);
    return parsed?.body ?? '';
  }

  async getBodies(projectId: string, noteIds: string[]): Promise<Map<string, string>> {
    const activeIndex = this.activeProjectId === projectId ? this.indexService : null;
    const cached = activeIndex
      ? await activeIndex.getBodies(noteIds)
      : new Map<string, string>();
    if (cached.size === noteIds.length) return cached;

    const missing = noteIds.filter((id) => !cached.has(id));
    const transport = await this.vaultService.getLocalClient(projectId);
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
    return this.mutationQueue.run(projectId, async () => {
      const transport = await this.vaultService.getLocalClient(projectId);
      await updateNoteOp(transport, noteId, content);

      if (this.activeProjectId === projectId && this.indexService) {
        const raw = await transport.read(noteFilePath(noteId));
        await this.indexService.indexNote(noteId, raw);
        this.searchProvider.update(noteId, content);
      }
    });
  }

  async deleteNote(projectId: string, noteId: string): Promise<void> {
    return this.mutationQueue.run(projectId, () => this.deleteNoteInner(projectId, noteId));
  }

  private async deleteNoteInner(projectId: string, noteId: string): Promise<void> {
    const transport = await this.vaultService.getLocalClient(projectId);

    const note = await this.readNoteForDelete(projectId, noteId);
    const attachmentPaths = this.extractAttachmentPaths(note);

    await deleteNoteOp(
      transport,
      async (id) => {
        await this.callbacks?.onDeleteNote?.(projectId, id);
      },
      noteId,
    );

    if (this.activeProjectId === projectId && this.indexService) {
      await this.indexService.removeNoteIndex(noteId);
      this.searchProvider.remove(noteId);
    }

    if (attachmentPaths.length > 0) {
      await this.deleteOrphanedAttachments(projectId, attachmentPaths);
    }
  }

  async createNoteGuarded(
    projectId: string,
    content: string,
    options?: CreateNoteOptions,
  ): Promise<{ noteId: string } & GuardedWriteResult> {
    return this.mutationQueue.run(projectId, async () => {
      const transport = await this.vaultService.getLocalClient(projectId);
      const created = await createNoteGuarded(transport, content, options);

      if (this.activeProjectId === projectId && this.indexService) {
        await this.indexService.indexNote(created.noteId, created.raw);
        this.searchProvider.add(created.noteId, content);
      }
      return { noteId: created.noteId, revision: created.revision };
    });
  }

  async updateNoteGuarded(
    projectId: string,
    noteId: string,
    update: UpdateNoteInput,
    expectedRevision: string,
  ): Promise<GuardedWriteResult> {
    return this.mutationQueue.run(projectId, async () => {
      const transport = await this.vaultService.getLocalClient(projectId);
      const result = await updateNoteGuarded(transport, noteId, update, expectedRevision);

      if (this.activeProjectId === projectId && this.indexService) {
        await this.indexService.indexNote(noteId, result.raw);
        this.searchProvider.update(noteId, result.body);
      }
      return { revision: result.revision };
    });
  }

  async deleteNoteGuarded(
    projectId: string,
    noteId: string,
    expectedRevision: string,
  ): Promise<void> {
    return this.mutationQueue.run(projectId, async () => {
      const transport = await this.vaultService.getLocalClient(projectId);

      const note = await this.readNoteForDelete(projectId, noteId);
      const attachmentPaths = this.extractAttachmentPaths(note);

      await deleteNoteGuarded(
        transport,
        async (id) => {
          await this.callbacks?.onDeleteNote?.(projectId, id);
        },
        noteId,
        expectedRevision,
      );

      if (this.activeProjectId === projectId && this.indexService) {
        await this.indexService.removeNoteIndex(noteId);
        this.searchProvider.remove(noteId);
      }

      if (attachmentPaths.length > 0) {
        await this.deleteOrphanedAttachments(projectId, attachmentPaths);
      }
    });
  }

  async saveNoteWithAttachments(
    projectId: string,
    noteId: string,
    options: SaveNoteOptions,
  ): Promise<void> {
    return this.mutationQueue.run(projectId, () =>
      this.saveNoteWithAttachmentsInner(projectId, noteId, options),
    );
  }

  private async saveNoteWithAttachmentsInner(
    projectId: string,
    noteId: string,
    options: SaveNoteOptions,
  ): Promise<void> {
    const transport = await this.vaultService.getLocalClient(projectId);
    const path = noteFilePath(noteId);
    const exists = await transport.exists(path);
    if (!exists) throw new Error(`Note not found: ${noteId}`);

    const currentRaw = await transport.read(path);
    if (options.expectedRevision !== undefined) {
      const currentRevision = await computeNoteRevision(currentRaw);
      if (currentRevision !== options.expectedRevision) {
        throw new AutomationOperationError(
          'REVISION_CONFLICT',
          `Note ${noteId} changed since read`,
          {
            details: {
              currentRevision,
              expectedRevision: options.expectedRevision,
            },
          },
        );
      }
    }

    const attSvc = createAttachmentService(transport);

    const pendingAttachments = options.attachments.filter(
      (a): a is PendingAttachment => a.type === 'pending',
    );
    for (const pending of pendingAttachments) {
      await attSvc.write(pending.path, pending.data);
    }

    const attachments: AttachmentRef[] = options.attachments.map((a) => ({
      path: a.path,
      ...(a.name ? { name: a.name } : {}),
      ...(a.mime ? { mime: a.mime } : {}),
      ...(a.size != null ? { size: a.size } : {}),
    }));

    const existing = parseNote(currentRaw);
    const now = new Date().toISOString();
    const extractedTags = extractTagsFromBody(options.body);
    const existingTags = normalizeTags(existing.frontmatter.tags);
    const mergedTags = [...new Set([...existingTags, ...extractedTags])];
    const updatedFm: NoteFrontmatter = {
      ...existing.frontmatter,
      updated_at: now,
      ...(mergedTags.length > 0 ? { tags: mergedTags } : {}),
      attachments,
    };
    const raw = serializeNote(updatedFm, options.body);
    await transport.write(path, raw);

    if (options.removedPaths.length > 0) {
      await this.deleteOrphanedAttachments(projectId, options.removedPaths);
    }

    if (this.activeProjectId === projectId && this.indexService) {
      await this.indexService.indexNote(noteId, raw);
      this.searchProvider.update(noteId, options.body);
    }
  }

  async getAttachmentService(projectId: string): Promise<AttachmentService> {
    const transport = await this.vaultService.getLocalClient(projectId);
    return createAttachmentService(transport);
  }

  async getAttachmentBlob(projectId: string, path: string): Promise<ArrayBuffer> {
    const transport = await this.vaultService.getLocalClient(projectId);
    return transport.readBinary(path);
  }

  async garbageCollectAttachments(projectId: string): Promise<number> {
    const transport = await this.vaultService.getLocalClient(projectId);
    const attSvc = createAttachmentService(transport);

    const referenced = await this.collectAllReferencedPaths(projectId);
    const stored = await attSvc.listAll();

    let deleted = 0;
    for (const path of stored) {
      if (!referenced.has(path)) {
        await attSvc.remove(path);
        deleted++;
      }
    }
    return deleted;
  }

  async applyExternalChange(
    projectId: string,
    noteId: string,
  ): Promise<'changed' | 'deleted' | 'unchanged' | 'invalid' | 'inactive'> {
    if (this.activeProjectId !== projectId || !this.indexService) return 'inactive';
    return this.mutationQueue.run(projectId, async () => {
      if (this.activeProjectId !== projectId || !this.indexService) return 'inactive' as const;
      return this.applyExternalChangeInner(projectId, noteId);
    });
  }

  private async applyExternalChangeInner(
    projectId: string,
    noteId: string,
  ): Promise<'changed' | 'deleted' | 'unchanged' | 'invalid'> {
    const svc = this.requireActiveIndex();
    const transport = await this.vaultService.getLocalClient(projectId);
    const path = noteFilePath(noteId);
    let exists = false;
    try {
      exists = await transport.exists(path);
    } catch {
      return 'invalid';
    }
    const indexed = await svc.getIndex(noteId);

    if (!exists) {
      if (indexed) {
        await svc.removeNoteIndex(noteId);
        this.searchProvider.remove(noteId);
        return 'deleted';
      }
      return 'unchanged';
    }

    let raw: string;
    try {
      raw = await transport.read(path);
    } catch {
      return 'invalid';
    }
    const parsed = parseNoteSafe(raw);
    if (!parsed) return 'invalid';

    const cachedBody = await svc.getBody(noteId);
    const parsedUpdated = new Date(parsed.frontmatter.updated_at).getTime();
    // comparing cached body + updated_at against disk detects both external
    // edits and our own write echoes (index already matches → unchanged)
    if (indexed && cachedBody === parsed.body && indexed.updated_at === parsedUpdated) {
      return 'unchanged';
    }

    await svc.indexNote(noteId, raw);
    if (indexed) this.searchProvider.update(noteId, parsed.body);
    else this.searchProvider.add(noteId, parsed.body);
    return 'changed';
  }

  async reconcileVault(projectId: string): Promise<string[]> {
    if (this.activeProjectId !== projectId || !this.indexService) return [];
    return this.mutationQueue.run(projectId, async () => {
      if (this.activeProjectId !== projectId || !this.indexService) return [];
      const svc = this.indexService;
      const transport = await this.vaultService.getLocalClient(projectId);
      const changed: string[] = [];

      const volumes = await transport.list('');
      const seen = new Set<string>();
      for (const vol of volumes) {
        if (!isVolumeEntry(vol)) continue;
        const items = await transport.list(vol.basename);
        for (const item of items) {
          if (!isNoteFileEntry(item)) continue;
          const noteId = noteIdFromFilename(item.basename);
          if (!noteId) continue;
          seen.add(noteId);
          const outcome = await this.applyExternalChangeInner(projectId, noteId);
          if (outcome === 'changed') changed.push(noteId);
        }
      }

      // indexed notes whose files vanished count as externally deleted
      for (const id of await svc.getAllNoteIds()) {
        if (!seen.has(id)) {
          const outcome = await this.applyExternalChangeInner(projectId, id);
          if (outcome === 'deleted') changed.push(id);
        }
      }
      return changed;
    });
  }

  async activateVault(projectId: string): Promise<void> {
    if (this.activeProjectId === projectId && this.indexService) return;

    this.indexService = null;
    this.searchProvider.clear();

    this.indexService = createIndexService(projectId);

    const existingIds = await this.indexService.getAllNoteIds();

    if (existingIds.size > 0) {
      const bodies = await this.indexService.getAllBodies();
      for (const [id, body] of bodies) {
        this.searchProvider.add(id, body);
      }
    }

    const transport = await this.vaultService.getLocalClient(projectId);
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
    const svc = this.indexService;
    for (let i = 0; i < notesToProcess.length; i += CONCURRENCY) {
      const batch = notesToProcess.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async ({ noteId, path }) => {
          const raw = await transport.read(path);
          await svc.indexNote(noteId, raw);
          const parsed = parseNoteSafe(raw);
          if (parsed) this.searchProvider.add(noteId, parsed.body);
        }),
      );
    }

    this.activeProjectId = projectId;
  }

  deactivateVault(): void {
    this.indexService = null;
    this.searchProvider.clear();
    this.activeProjectId = null;
  }

  async rebuildIndex(projectId: string): Promise<void> {
    if (this.indexService) {
      await this.indexService.clearIndex();
      this.indexService = null;
    }
    this.searchProvider.clear();
    this.activeProjectId = null;
    await this.activateVault(projectId);
  }

  async listNotes(options?: ListNotesOptions): Promise<NoteIndex[]> {
    this.ensureActive();
    return this.idx.getTimeline(options);
  }

  async countNotes(): Promise<number> {
    this.ensureActive();
    return this.idx.countNotes();
  }

  async searchNotes(query: string): Promise<NoteIndex[]> {
    this.ensureActive();
    const parsed = parseSearchQuery(query);

    let candidateIds: Set<string> | null = null;

    if (parsed.tags.length > 0) {
      for (const tag of parsed.tags) {
        const notesByTag = await this.idx.getNotesByTag(tag);
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
      return this.idx.getTimeline();
    }

    const indexes: NoteIndex[] = [];
    for (const id of finalIds) {
      const idx = await this.idx.getIndex(id);
      if (idx) indexes.push(idx);
    }

    indexes.sort((a, b) => b.updated_at - a.updated_at);

    return indexes;
  }

  async getNotesByTag(tag: string): Promise<NoteIndex[]> {
    this.ensureActive();
    return this.idx.getNotesByTag(tag);
  }

  async getAllTags(): Promise<string[]> {
    this.ensureActive();
    return this.idx.getAllTags();
  }

  async getTagsWithCounts(): Promise<{ name: string; count: number }[]> {
    this.ensureActive();
    return this.idx.getTagsWithCounts();
  }

  async getNoteIndex(noteId: string): Promise<NoteIndex | undefined> {
    this.ensureActive();
    return this.idx.getIndex(noteId);
  }

  private ensureActive(): void {
    if (!this.activeProjectId || !this.indexService) {
      throw new Error('No active vault. Call activateVault() first.');
    }
  }

  /** Narrowed accessor for paths that already verified an active vault but
   * run inside the mutation queue (activation state re-checked by callers). */
  private requireActiveIndex(): IndexService {
    if (!this.indexService) {
      throw new Error('No active vault. Call activateVault() first.');
    }
    return this.indexService;
  }

  private async readNoteForDelete(projectId: string, noteId: string): Promise<ParsedNote | null> {
    try {
      const transport = await this.vaultService.getLocalClient(projectId);
      const path = noteFilePath(noteId);
      const raw = await transport.read(path);
      return parseNote(raw);
    } catch {
      return null;
    }
  }

  private extractAttachmentPaths(note: ParsedNote | null): string[] {
    if (!note?.frontmatter.attachments) return [];
    return note.frontmatter.attachments.map((a) => a.path);
  }

  private async collectAllReferencedPaths(projectId: string): Promise<Set<string>> {
    const transport = await this.vaultService.getLocalClient(projectId);
    const referenced = new Set<string>();
    const volumes = await transport.list('');
    for (const vol of volumes) {
      if (vol.type !== 'directory' || !isVolumeEntry(vol)) continue;
      const items = await transport.list(vol.basename);
      for (const item of items) {
        if (item.type !== 'file' || !isNoteFileEntry(item)) continue;
        try {
          const raw = await transport.read(`${vol.basename}/${item.basename}`);
          const parsed = parseNoteSafe(raw);
          if (parsed?.frontmatter.attachments) {
            for (const att of parsed.frontmatter.attachments) {
              referenced.add(att.path);
            }
          }
        } catch {
          // skip unreadable notes
        }
      }
    }
    return referenced;
  }

  private async deleteOrphanedAttachments(projectId: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const referenced = await this.collectAllReferencedPaths(projectId);
    const transport = await this.vaultService.getLocalClient(projectId);
    for (const path of paths) {
      if (!referenced.has(path)) {
        try {
          await transport.remove(path);
        } catch {
          // already deleted or inaccessible
        }
      }
    }
  }
}

export { parseSearchQuery };
