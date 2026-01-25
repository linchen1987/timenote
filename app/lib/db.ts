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

export class TimenoteDatabase extends Dexie {
  notebooks!: Table<Notebook>;
  notes!: Table<Note>;

  constructor() {
    super('TimenoteDB');
    this.version(2).stores({
      notebooks: 'id, name, createdAt, updatedAt',
      notes: 'id, notebookId, createdAt, updatedAt'
    });
  }
}

export const db = new TimenoteDatabase();
