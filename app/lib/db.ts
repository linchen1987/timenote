import Dexie, { type Table } from 'dexie';
import { nanoid } from 'nanoid';
import { initSyncTracker } from '~/lib/services/sync/tracker';
import type { MenuItem, Note, Notebook, NoteTag, SyncEvent, Tag } from '~/lib/types';

export const generateId = () => nanoid(12);

// 定义数据库中所有的表名
export const TABLE_NAMES = {
  NOTEBOOKS: 'notebooks',
  NOTES: 'notes',
  TAGS: 'tags',
  NOTE_TAGS: 'noteTags',
  MENU_ITEMS: 'menuItems',
  SYNC_EVENTS: 'syncEvents',
} as const;

// 定义需要同步追踪的表名
export const SYNCABLE_TABLES = [
  TABLE_NAMES.NOTEBOOKS,
  TABLE_NAMES.NOTES,
  TABLE_NAMES.TAGS,
  TABLE_NAMES.MENU_ITEMS,
  TABLE_NAMES.NOTE_TAGS,
] as const;
export type SyncableTableName = (typeof SYNCABLE_TABLES)[number];

export const ALL_TABLES = Object.values(TABLE_NAMES);
export type AppTableName = (typeof ALL_TABLES)[number];

export class TimenoteDatabase extends Dexie {
  notebooks!: Table<Notebook>;
  notes!: Table<Note>;
  tags!: Table<Tag>;
  noteTags!: Table<NoteTag>;
  menuItems!: Table<MenuItem>;
  syncEvents!: Table<SyncEvent>;

  constructor() {
    super('TimenoteDB');
    this.version(6).stores({
      notebooks: 'id, name, createdAt, updatedAt',
      notes: 'id, notebookId, createdAt, updatedAt, [notebookId+updatedAt]',
      tags: 'id, notebookId, name',
      noteTags: '[noteId+tagId], noteId, tagId, notebookId',
      menuItems: 'id, notebookId, parentId, order',
      syncEvents: 'id, notebookId, createdAt, [notebookId+createdAt]',
    });

    // Add hooks for tracking changes
    initSyncTracker(this);
  }
}

export const db = new TimenoteDatabase();
