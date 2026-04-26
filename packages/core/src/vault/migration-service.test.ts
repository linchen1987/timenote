import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import type { MenuItem, Note, Notebook, NoteTag, Tag } from '../types';
import { createMigrationService, type MigrationProgress } from './migration-service';

function createNotebook(overrides: Partial<Notebook> = {}): Notebook {
  const now = Date.now();
  return {
    id: `nb_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Notebook',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createNote(notebookId: string, overrides: Partial<Note> = {}): Note {
  const now = Date.now();
  return {
    id: `note_${Math.random().toString(36).slice(2, 10)}`,
    notebookId,
    content: 'Test content',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createTag(notebookId: string, name: string): Tag {
  return {
    id: `tag_${Math.random().toString(36).slice(2, 8)}`,
    notebookId,
    name,
    createdAt: Date.now(),
  };
}

function createNoteTag(noteId: string, tagId: string, notebookId: string): NoteTag {
  return { noteId, tagId, notebookId };
}

function createMenuItem(notebookId: string, overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: `mi_${Math.random().toString(36).slice(2, 8)}`,
    notebookId,
    parentId: null,
    name: 'Test Item',
    type: 'note',
    target: 'some-note-id',
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('MigrationService', () => {
  let service: ReturnType<typeof createMigrationService>;

  beforeEach(async () => {
    service = createMigrationService();
    await db.notebooks.clear();
    await db.notes.clear();
    await db.tags.clear();
    await db.noteTags.clear();
    await db.menuItems.clear();
    await db.syncEvents.clear();
  });

  describe('needsMigration', () => {
    it('returns false when no notebooks exist', async () => {
      expect(await service.needsMigration()).toBe(false);
    });

    it('returns true when notebooks exist', async () => {
      await db.notebooks.add(createNotebook());
      expect(await service.needsMigration()).toBe(true);
    });
  });

  describe('listLegacyNotebooks', () => {
    it('returns empty array when no notebooks', async () => {
      const list = await service.listLegacyNotebooks();
      expect(list).toEqual([]);
    });

    it('returns notebooks with note counts', async () => {
      const nb1 = createNotebook({ name: 'Alpha' });
      const nb2 = createNotebook({ name: 'Beta' });
      await db.notebooks.bulkAdd([nb1, nb2]);
      await db.notes.bulkAdd([createNote(nb1.id), createNote(nb1.id), createNote(nb2.id)]);

      const list = await service.listLegacyNotebooks();
      expect(list).toHaveLength(2);

      const alpha = list.find((n) => n.name === 'Alpha');
      const beta = list.find((n) => n.name === 'Beta');
      expect(alpha?.noteCount).toBe(2);
      expect(beta?.noteCount).toBe(1);
    });
  });

  describe('exportNotebook', () => {
    it('exports a notebook with notes as valid ZIP', async () => {
      const nb = createNotebook({ name: 'ExportTest' });
      await db.notebooks.add(nb);
      await db.notes.bulkAdd([
        createNote(nb.id, { content: 'Hello world' }),
        createNote(nb.id, { content: 'Second note' }),
      ]);

      const result = await service.exportNotebook(nb.id);

      expect(result.notebookName).toBe('ExportTest');
      expect(result.notesCount).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.zipBlob).toBeInstanceOf(Blob);

      const zip = await JSZip.loadAsync(result.zipBuffer);
      const manifestRaw = await zip.file('.timenote/manifest.json')?.async('string');
      const manifest = JSON.parse(manifestRaw!);
      expect(manifest.name).toBe('ExportTest');
      expect(manifest.project_id).toBe(nb.id);
      expect(manifest.version).toBe('1.0.0');

      const menuRaw = await zip.file('.timenote/menu.json')?.async('string');
      const menu = JSON.parse(menuRaw!);
      expect(menu.version).toBe(1);
      expect(menu.items).toEqual([]);

      const deleteLogRaw = await zip.file('.timenote/delete-log.json')?.async('string');
      const deleteLog = JSON.parse(deleteLogRaw!);
      expect(deleteLog.version).toBe(1);
      expect(deleteLog.records).toEqual({});

      const noteFiles: string[] = [];
      zip.forEach((path) => {
        if (/^\d{4}-\d{2}\/\d{8}-\d{6}-\d{4}\.md$/.test(path)) {
          noteFiles.push(path);
        }
      });
      expect(noteFiles).toHaveLength(2);
    });

    it('exports notes with tags in frontmatter', async () => {
      const nb = createNotebook({ name: 'TagTest' });
      const note = createNote(nb.id, { content: 'Tagged note' });
      const tag1 = createTag(nb.id, '架构');
      const tag2 = createTag(nb.id, 'Web');
      await db.notebooks.add(nb);
      await db.notes.add(note);
      await db.tags.bulkAdd([tag1, tag2]);
      await db.noteTags.bulkAdd([
        createNoteTag(note.id, tag1.id, nb.id),
        createNoteTag(note.id, tag2.id, nb.id),
      ]);

      const result = await service.exportNotebook(nb.id);
      const zip = await JSZip.loadAsync(result.zipBuffer);

      let noteContent = '';
      zip.forEach((path, file) => {
        if (/\.md$/.test(path)) noteContent = file.name;
      });

      const noteFile = Object.values(zip.files).find((f) => f.name.endsWith('.md') && !f.dir);
      const content = await noteFile!.async('string');
      expect(content).toContain('架构');
      expect(content).toContain('Web');
      expect(content).toContain('Tagged note');
    });

    it('exports menu items with ID mapping', async () => {
      const nb = createNotebook({ name: 'MenuTest' });
      const note = createNote(nb.id, { content: 'Menu note' });
      await db.notebooks.add(nb);
      await db.notes.add(note);

      await db.menuItems.bulkAdd([
        createMenuItem(nb.id, {
          name: 'My Note',
          type: 'note',
          target: note.id,
          parentId: null,
          order: 0,
        }),
        createMenuItem(nb.id, {
          name: 'Search',
          type: 'search',
          target: 'hello',
          parentId: null,
          order: 1,
        }),
      ]);

      const result = await service.exportNotebook(nb.id);
      const zip = await JSZip.loadAsync(result.zipBuffer);
      const menuRaw = await zip.file('.timenote/menu.json')?.async('string');
      const menu = JSON.parse(menuRaw!);

      expect(menu.items).toHaveLength(2);
      expect(menu.items[0].title).toBe('My Note');
      expect(menu.items[0].type).toBe('note');
      expect(menu.items[0].note_id).not.toBe(note.id);

      expect(menu.items[1].title).toBe('Search');
      expect(menu.items[1].type).toBe('search');
      expect(menu.items[1].search).toBe('hello');
    });

    it('exports nested menu items', async () => {
      const nb = createNotebook({ name: 'NestedMenu' });
      await db.notebooks.add(nb);

      const parentId = 'mi_parent';
      const childId = 'mi_child';
      await db.menuItems.bulkAdd([
        createMenuItem(nb.id, {
          id: parentId,
          name: 'Folder',
          type: 'search',
          target: 'folder-query',
          parentId: null,
          order: 0,
        }),
        createMenuItem(nb.id, {
          id: childId,
          name: 'Child',
          type: 'search',
          target: 'child-query',
          parentId: parentId,
          order: 0,
        }),
      ]);

      const result = await service.exportNotebook(nb.id);
      const zip = await JSZip.loadAsync(result.zipBuffer);
      const menuRaw = await zip.file('.timenote/menu.json')?.async('string');
      const menu = JSON.parse(menuRaw!);

      expect(menu.items).toHaveLength(1);
      expect(menu.items[0].title).toBe('Folder');
      expect(menu.items[0].children).toHaveLength(1);
      expect(menu.items[0].children[0].title).toBe('Child');
    });

    it('throws for non-existent notebook', async () => {
      await expect(service.exportNotebook('nonexistent')).rejects.toThrow('not found');
    });

    it('reports progress', async () => {
      const nb = createNotebook({ name: 'ProgressTest' });
      await db.notebooks.add(nb);
      await db.notes.bulkAdd([createNote(nb.id), createNote(nb.id)]);

      const progress: MigrationProgress[] = [];
      await service.exportNotebook(nb.id, (p) => progress.push(p));

      expect(progress.length).toBeGreaterThan(0);
      expect(progress[0].phase).toBe('reading');
      const writingPhases = progress.filter((p) => p.phase === 'writing');
      expect(writingPhases.length).toBeGreaterThan(0);
      expect(writingPhases[writingPhases.length - 1].current).toBe(2);
      expect(writingPhases[writingPhases.length - 1].total).toBe(2);
    });

    it('generates valid note IDs (YYYYMMDD-HHmmss-SSSR)', async () => {
      const nb = createNotebook({ name: 'IdTest' });
      const note = createNote(nb.id, { createdAt: new Date('2026-04-25T12:10:00Z').getTime() });
      await db.notebooks.add(nb);
      await db.notes.add(note);

      const result = await service.exportNotebook(nb.id);
      const zip = await JSZip.loadAsync(result.zipBuffer);

      const noteFile = Object.values(zip.files).find((f) => f.name.endsWith('.md') && !f.dir);
      const filename = noteFile!.name.split('/').pop()!;
      expect(filename).toMatch(/^\d{8}-\d{6}-\d{4}\.md$/);
    });
  });

  describe('clearLegacyData', () => {
    it('clears all legacy tables', async () => {
      const nb = createNotebook();
      await db.notebooks.add(nb);
      await db.notes.add(createNote(nb.id));
      await db.tags.add(createTag(nb.id, 'test'));
      await db.noteTags.add(createNoteTag('x', 'y', nb.id));
      await db.menuItems.add(createMenuItem(nb.id));

      await service.clearLegacyData();

      expect(await db.notebooks.count()).toBe(0);
      expect(await db.notes.count()).toBe(0);
      expect(await db.tags.count()).toBe(0);
      expect(await db.noteTags.count()).toBe(0);
      expect(await db.menuItems.count()).toBe(0);
    });
  });
});
