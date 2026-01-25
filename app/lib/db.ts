import Dexie, { type Table } from 'dexie';
import { nanoid } from 'nanoid';

export const generateId = () => nanoid(12);

export interface Notebook {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  notebookId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  notebookId: string;
  name: string;
  createdAt: number;
}

export interface NoteTag {
  noteId: string;
  tagId: string;
}

export interface MenuItem {
  id: string;
  notebookId: string;
  parentId: string | null;
  name: string;
  type: 'note' | 'search';
  target: string; // noteId or search query
  order: number;
  createdAt: number;
  updatedAt: number;
}

export class TimenoteDatabase extends Dexie {
  notebooks!: Table<Notebook>;
  notes!: Table<Note>;
  tags!: Table<Tag>;
  noteTags!: Table<NoteTag>;
  menuItems!: Table<MenuItem>;

  constructor() {
    super('TimenoteDB');
    this.version(4).stores({
      notebooks: 'id, name, createdAt, updatedAt',
      notes: 'id, notebookId, createdAt, updatedAt',
      tags: 'id, notebookId, name',
      noteTags: '[noteId+tagId], noteId, tagId',
      menuItems: 'id, notebookId, parentId, order'
    });
  }
}

export const db = new TimenoteDatabase();
