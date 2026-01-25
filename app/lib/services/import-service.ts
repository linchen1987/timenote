import { db, type Notebook, type Note, type Tag, type NoteTag, type MenuItem } from '../db';

export interface ImportData {
  notebooks?: Notebook[];
  notes?: Note[];
  tags?: Tag[];
  noteTags?: NoteTag[];
  menuItems?: MenuItem[];
}

export const ImportService = {
  async importData(data: ImportData): Promise<{ success: number; skipped: number; errors: string[] }> {
    const stats = { success: 0, skipped: 0, errors: [] as string[] };

    await db.transaction('rw', [db.notebooks, db.notes, db.tags, db.noteTags, db.menuItems], async () => {
      // 1. Process Notebooks
      const importedNotebookIds = new Set<string>();
      if (data.notebooks) {
        for (const nb of data.notebooks) {
          const existing = await db.notebooks.get(nb.id);
          if (!existing || nb.updatedAt > existing.updatedAt) {
            await db.notebooks.put(nb);
            stats.success++;
          } else {
            stats.skipped++;
          }
          importedNotebookIds.add(nb.id);
        }
      }

      // Helper to check if notebook exists (either in DB or just imported)
      const notebookExists = async (id: string) => {
        if (importedNotebookIds.has(id)) return true;
        const count = await db.notebooks.where('id').equals(id).count();
        return count > 0;
      };

      // 2. Process Tags (needed for NoteTags)
      const importedTagIds = new Set<string>();
      if (data.tags) {
        for (const tag of data.tags) {
          if (await notebookExists(tag.notebookId)) {
            await db.tags.put(tag); // Tags don't have updatedAt in schema, but put is fine
            stats.success++;
            importedTagIds.add(tag.id);
          } else {
            stats.skipped++;
            stats.errors.push(`Tag ${tag.name} skipped: associated notebook ${tag.notebookId} not found.`);
          }
        }
      }

      // 3. Process Notes
      const importedNoteIds = new Set<string>();
      if (data.notes) {
        for (const note of data.notes) {
          if (await notebookExists(note.notebookId)) {
            const existing = await db.notes.get(note.id);
            if (!existing || note.updatedAt > existing.updatedAt) {
              await db.notes.put(note);
              stats.success++;
            } else {
              stats.skipped++;
            }
            importedNoteIds.add(note.id);
          } else {
            stats.skipped++;
            stats.errors.push(`Note skipped: associated notebook ${note.notebookId} not found.`);
          }
        }
      }

      // 4. Process MenuItems
      if (data.menuItems) {
        for (const item of data.menuItems) {
          if (await notebookExists(item.notebookId)) {
            const existing = await db.menuItems.get(item.id);
            if (!existing || item.updatedAt > existing.updatedAt) {
              await db.menuItems.put(item);
              stats.success++;
            } else {
              stats.skipped++;
            }
          } else {
            stats.skipped++;
            stats.errors.push(`Menu item ${item.name} skipped: associated notebook ${item.notebookId} not found.`);
          }
        }
      }

      // 5. Process NoteTags
      if (data.noteTags) {
        for (const nt of data.noteTags) {
          const noteExists = importedNoteIds.has(nt.noteId) || (await db.notes.get(nt.noteId));
          const tagExists = importedTagIds.has(nt.tagId) || (await db.tags.get(nt.tagId));
          
          if (noteExists && tagExists) {
            await db.noteTags.put(nt);
            stats.success++;
          } else {
            stats.skipped++;
          }
        }
      }
    });

    return stats;
  }
};
