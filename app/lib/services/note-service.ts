import { db, generateId, type Notebook, type Note } from '../db';

export const NoteService = {
  // --- Notebook Operations ---
  
  async getAllNotebooks(): Promise<Notebook[]> {
    return db.notebooks.toArray();
  },

  async getNotebook(id: string): Promise<Notebook | undefined> {
    return db.notebooks.get(id);
  },

  async createNotebook(name: string): Promise<string> {
    const id = generateId();
    await db.notebooks.add({
      id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  },

  async updateNotebook(id: string, updates: Partial<Omit<Notebook, 'id' | 'createdAt'>>): Promise<void> {
    await db.notebooks.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },

  async deleteNotebook(id: string): Promise<void> {
    await db.transaction('rw', db.notebooks, db.notes, async () => {
      await db.notebooks.delete(id);
      await db.notes.where('notebookId').equals(id).delete();
    });
  },

  // --- Note Operations ---

  async getNotesByNotebook(notebookId: string): Promise<Note[]> {
    return db.notes.where("notebookId").equals(notebookId).reverse().toArray();
  },

  async getNote(id: string): Promise<Note | undefined> {
    return db.notes.get(id);
  },

  async createNote(notebookId: string): Promise<string> {
    const id = generateId();
    await db.notes.add({
      id,
      notebookId,
      content: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  },

  async updateNote(id: string, content: string): Promise<void> {
    await db.notes.update(id, {
      content,
      updatedAt: Date.now(),
    });
  },

  async deleteNote(id: string): Promise<void> {
    await db.notes.delete(id);
  }
};
