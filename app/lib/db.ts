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

export class TimenoteDatabase extends Dexie {
  notebooks!: Table<Notebook>;
  notes!: Table<Note>;
  tags!: Table<Tag>;
  noteTags!: Table<NoteTag>;

  constructor() {
    super('TimenoteDB');
    this.version(3).stores({
      notebooks: 'id, name, createdAt, updatedAt',
      notes: 'id, notebookId, createdAt, updatedAt',
      tags: 'id, notebookId, name',
      noteTags: '[noteId+tagId], noteId, tagId'
    });
  }
}

export const db = new TimenoteDatabase();
