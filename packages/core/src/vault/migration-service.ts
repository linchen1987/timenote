import JSZip from 'jszip';
import { db } from '../db';
import type { MenuItem as OldMenuItem, Note as OldNote, Notebook as OldNotebook } from '../types';
import { filenameFromNoteId, generateNoteId, volumeNameFromNoteId } from './note-id';
import { serializeNote, type NoteFrontmatter } from './frontmatter';
import type { Manifest, MenuData, MenuItem } from './types';

export interface LegacyNotebookInfo {
  id: string;
  name: string;
  noteCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface MigrationProgress {
  phase: 'reading' | 'writing';
  current: number;
  total: number;
  currentNotebook: string;
}

export interface MigrationResult {
  notebookId: string;
  notebookName: string;
  notesCount: number;
  zipBlob: Blob;
  zipBuffer: ArrayBuffer;
  errors: string[];
}

export interface MigrationService {
  needsMigration(): Promise<boolean>;
  listLegacyNotebooks(): Promise<LegacyNotebookInfo[]>;
  exportNotebook(
    notebookId: string,
    onProgress?: (p: MigrationProgress) => void,
  ): Promise<MigrationResult>;
  clearLegacyData(): Promise<void>;
}

export function createMigrationService(): MigrationService {
  return new MigrationServiceImpl();
}

class MigrationServiceImpl implements MigrationService {
  async needsMigration(): Promise<boolean> {
    try {
      const count = await db.notebooks.count();
      return count > 0;
    } catch {
      return false;
    }
  }

  async listLegacyNotebooks(): Promise<LegacyNotebookInfo[]> {
    const notebooks = await db.notebooks.toArray();
    const result: LegacyNotebookInfo[] = [];

    for (const nb of notebooks) {
      const noteCount = await db.notes.where('notebookId').equals(nb.id).count();
      result.push({
        id: nb.id,
        name: nb.name,
        noteCount,
        createdAt: nb.createdAt,
        updatedAt: nb.updatedAt,
      });
    }

    return result;
  }

  async exportNotebook(
    notebookId: string,
    onProgress?: (p: MigrationProgress) => void,
  ): Promise<MigrationResult> {
    const notebook = await db.notebooks.get(notebookId);
    if (!notebook) throw new Error(`Notebook ${notebookId} not found`);

    const errors: string[] = [];

    onProgress?.({ phase: 'reading', current: 0, total: 0, currentNotebook: notebook.name });

    const notes = await db.notes.where('notebookId').equals(notebookId).toArray();
    const tags = await db.tags.where('notebookId').equals(notebookId).toArray();
    const noteTags = await db.noteTags.where('notebookId').equals(notebookId).toArray();
    const menuItems = await db.menuItems.where('notebookId').equals(notebookId).toArray();

    const tagMap = new Map(tags.map((t) => [t.id, t.name]));
    const noteTagsMap = new Map<string, string[]>();
    for (const nt of noteTags) {
      const arr = noteTagsMap.get(nt.noteId) ?? [];
      const tagName = tagMap.get(nt.tagId);
      if (tagName) arr.push(tagName);
      noteTagsMap.set(nt.noteId, arr);
    }

    const idMapping: Record<string, string> = {};
    const usedIds = new Set<string>();

    for (const note of notes) {
      const newId = this.generateUniqueNoteId(note.createdAt, usedIds);
      idMapping[note.id] = newId;
      usedIds.add(newId);
    }

    const zip = new JSZip();

    const manifest = this.buildManifest(notebook);
    zip.file('.timenote/manifest.json', JSON.stringify(manifest, null, 2));

    const menuData = this.buildMenuData(menuItems, idMapping);
    zip.file('.timenote/menu.json', JSON.stringify(menuData, null, 2));

    const deleteLog = { version: 1, records: {} };
    zip.file('.timenote/delete-log.json', JSON.stringify(deleteLog, null, 2));

    onProgress?.({
      phase: 'writing',
      current: 0,
      total: notes.length,
      currentNotebook: notebook.name,
    });

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const newId = idMapping[note.id];
      if (!newId) continue;

      try {
        const tagsForNote = noteTagsMap.get(note.id) ?? [];
        const volume = volumeNameFromNoteId(newId);
        const filename = filenameFromNoteId(newId);
        const content = this.buildNoteContent(note, tagsForNote);
        zip.file(`${volume}/${filename}`, content);
      } catch (e) {
        errors.push(`Note "${note.id}": ${(e as Error).message}`);
      }

      onProgress?.({
        phase: 'writing',
        current: i + 1,
        total: notes.length,
        currentNotebook: notebook.name,
      });
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    return {
      notebookId: notebook.id,
      notebookName: notebook.name,
      notesCount: notes.length,
      zipBlob,
      zipBuffer,
      errors,
    };
  }

  async clearLegacyData(): Promise<void> {
    await Promise.all([
      db.notebooks.clear(),
      db.notes.clear(),
      db.tags.clear(),
      db.noteTags.clear(),
      db.menuItems.clear(),
      db.syncEvents.clear(),
    ]);
  }

  private generateUniqueNoteId(createdAtMs: number, usedIds: Set<string>): string {
    const date = new Date(createdAtMs);
    let id = generateNoteId(date);
    let attempts = 0;
    while (usedIds.has(id) && attempts < 100) {
      id = generateNoteId(date);
      attempts++;
    }
    return id;
  }

  private buildManifest(notebook: OldNotebook): Manifest {
    const now = new Date().toISOString();
    return {
      project_id: notebook.id,
      name: notebook.name,
      version: '1.0.0',
      created_at: new Date(notebook.createdAt).toISOString(),
      updated_at: new Date(notebook.updatedAt).toISOString(),
    };
  }

  private buildNoteContent(note: OldNote, tags: string[]): string {
    const frontmatter: NoteFrontmatter = {
      created_at: new Date(note.createdAt).toISOString(),
      updated_at: new Date(note.updatedAt).toISOString(),
      tags: tags.length > 0 ? tags : undefined,
    };
    return serializeNote(frontmatter, note.content || '');
  }

  private buildMenuData(oldItems: OldMenuItem[], idMapping: Record<string, string>): MenuData {
    const nested = this.flatToNested(oldItems, idMapping);
    return { version: 1, items: nested };
  }

  private flatToNested(oldItems: OldMenuItem[], idMapping: Record<string, string>): MenuItem[] {
    const byParent = new Map<string | null, OldMenuItem[]>();
    for (const item of oldItems) {
      const key = !item.parentId || item.parentId === 'root' ? null : item.parentId;
      const arr = byParent.get(key) ?? [];
      arr.push(item);
      byParent.set(key, arr);
    }

    for (const arr of byParent.values()) {
      arr.sort((a, b) => a.order - b.order);
    }

    const build = (parentId: string | null): MenuItem[] => {
      const children = byParent.get(parentId) ?? [];
      return children.map((item) => {
        const menuItem: MenuItem = {
          title: item.name,
          type: item.type,
        };

        if (item.type === 'note') {
          const oldTarget = item.target;
          menuItem.note_id = idMapping[oldTarget] ?? oldTarget;
        }

        if (item.type === 'search') {
          menuItem.search = item.target;
        }

        const subChildren = build(item.id);
        if (subChildren.length > 0) {
          menuItem.children = subChildren;
        }

        return menuItem;
      });
    };

    return build(null);
  }
}
