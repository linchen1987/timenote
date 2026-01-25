import Dexie, { type Table } from 'dexie';
import { nanoid } from 'nanoid';

// 生成 12 位友好的唯一 ID (字符集包含 A-Za-z0-9_-)
export const generateId = () => nanoid(12);

export interface Notebook {
  id: string; // 使用 nanoid
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string; // 使用 nanoid
  notebookId: string; // 关联 notebook 的 nanoid
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
