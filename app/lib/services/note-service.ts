import Dexie from 'dexie';
import { db, generateId, type Notebook, type Note, type Tag } from '../db';

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
    await db.transaction('rw', [db.notebooks, db.notes, db.tags, db.noteTags, db.menuItems], async () => {
      await db.notebooks.delete(id);
      await db.notes.where('notebookId').equals(id).delete();
      await db.tags.where('notebookId').equals(id).delete();
      await db.menuItems.where('notebookId').equals(id).delete();
    });
  },

  // --- Note Operations ---

  async getNotesByNotebook(notebookId: string, limit?: number): Promise<Note[]> {
    let query = db.notes
      .where('[notebookId+updatedAt]')
      .between([notebookId, Dexie.minKey], [notebookId, Dexie.maxKey])
      .reverse();

    if (limit) {
      return query.limit(limit).toArray();
    }
    return query.toArray();
  },

  async getNoteCountByNotebook(notebookId: string): Promise<number> {
    return db.notes.where("notebookId").equals(notebookId).count();
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
    await db.transaction('rw', db.notes, db.noteTags, async () => {
      await db.notes.delete(id);
      await db.noteTags.where('noteId').equals(id).delete();
    });
  },

  async syncNoteTagsFromContent(noteId: string, notebookId: string, content: string): Promise<void> {
    // 使用正则提取所有 #标签
    const hashtagRegex = /#([\w\u4e00-\u9fa5]+)/g;
    const matches = content.matchAll(hashtagRegex);
    const tagNames = Array.from(new Set(Array.from(matches).map(m => m[1])));

    await db.transaction('rw', db.tags, db.noteTags, async () => {
      // 1. 获取或创建这些标签
      const tagIds: string[] = [];
      for (const name of tagNames) {
        const tagId = await this.createTag(notebookId, name);
        tagIds.push(tagId);
      }

      // 2. 更新关联关系
      // 先删除现有的所有关联
      await db.noteTags.where('noteId').equals(noteId).delete();
      
      // 添加新的关联
      for (const tagId of tagIds) {
        await this.addTagToNote(noteId, tagId);
      }
    });
  },

  // --- Tag Operations ---

  async getTagsByNotebook(notebookId: string): Promise<Tag[]> {
    return db.tags.where('notebookId').equals(notebookId).toArray();
  },

  async getTagsWithCounts(notebookId: string): Promise<(Tag & { count: number })[]> {
    const tags = await db.tags.where('notebookId').equals(notebookId).toArray();
    const tagCounts = await Promise.all(tags.map(async tag => {
      const count = await db.noteTags.where('tagId').equals(tag.id).count();
      return { ...tag, count };
    }));
    return tagCounts;
  },

  async createTag(notebookId: string, name: string): Promise<string> {
    // Check if tag already exists in this notebook
    const existing = await db.tags.where({ notebookId, name }).first();
    if (existing) return existing.id;

    const id = generateId();
    await db.tags.add({
      id,
      notebookId,
      name,
      createdAt: Date.now(),
    });
    return id;
  },

  async deleteTag(id: string): Promise<void> {
    await db.transaction('rw', db.tags, db.noteTags, async () => {
      await db.tags.delete(id);
      await db.noteTags.where('tagId').equals(id).delete();
    });
  },

  // --- Note-Tag Association Operations ---

  async addTagToNote(noteId: string, tagId: string): Promise<void> {
    try {
      await db.noteTags.add({ noteId, tagId });
    } catch (e) {
      // Ignore duplicate errors
    }
  },

  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    await db.noteTags.where({ noteId, tagId }).delete();
  },

  async getTagsForNote(noteId: string): Promise<Tag[]> {
    const associations = await db.noteTags.where('noteId').equals(noteId).toArray();
    const tagIds = associations.map(a => a.tagId);
    return db.tags.where('id').anyOf(tagIds).toArray();
  },

  async getNotesByTag(tagId: string): Promise<Note[]> {
    const associations = await db.noteTags.where('tagId').equals(tagId).toArray();
    const noteIds = associations.map(a => a.noteId);
    return db.notes.where('id').anyOf(noteIds).reverse().toArray();
  },

  async getAllNotes(limit?: number): Promise<Note[]> {
    let query = db.notes.orderBy('updatedAt').reverse();
    if (limit) {
      return query.limit(limit).toArray();
    }
    return query.toArray();
  }
};
