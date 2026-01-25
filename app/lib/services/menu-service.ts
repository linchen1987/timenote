import { db, generateId, type MenuItem } from '../db';

export const MenuService = {
  async getMenuItemsByNotebook(notebookId: string): Promise<MenuItem[]> {
    return db.menuItems
      .where('notebookId')
      .equals(notebookId)
      .sortBy('order');
  },

  async createMenuItem(item: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    await db.menuItems.add({
      ...item,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  },

  async updateMenuItem(id: string, updates: Partial<Omit<MenuItem, 'id' | 'notebookId' | 'createdAt'>>): Promise<void> {
    await db.menuItems.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },

  async deleteMenuItem(id: string): Promise<void> {
    await db.transaction('rw', db.menuItems, async () => {
      // Also delete children
      const children = await db.menuItems.where('parentId').equals(id).toArray();
      for (const child of children) {
        await this.deleteMenuItem(child.id);
      }
      await db.menuItems.delete(id);
    });
  },

  async reorderMenuItems(items: { id: string; order: number; parentId: string | null }[]): Promise<void> {
    await db.transaction('rw', db.menuItems, async () => {
      for (const item of items) {
        await db.menuItems.update(item.id, {
          order: item.order,
          parentId: item.parentId,
          updatedAt: Date.now(),
        });
      }
    });
  }
};
