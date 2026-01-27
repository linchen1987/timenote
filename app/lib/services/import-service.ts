import { db } from '~/lib/db';
import type { BackupData, ImportStats } from '~/lib/services/backup-types';

export const ImportService = {
  async importData(data: BackupData): Promise<ImportStats> {
    const stats: ImportStats = { success: 0, skipped: 0, errors: [] };

    await db.transaction(
      'rw',
      [db.notebooks, db.notes, db.tags, db.noteTags, db.menuItems],
      async () => {
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
              stats.errors.push(
                `Tag ${tag.name} skipped: associated notebook ${tag.notebookId} not found.`,
              );
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
              // Normalize target if it's a JSON string from legacy/external format
              let normalizedTarget = item.target;
              if (item.type === 'search' && item.target.startsWith('[')) {
                try {
                  const parsed = JSON.parse(item.target);
                  if (Array.isArray(parsed)) {
                    normalizedTarget = parsed
                      .map((p: any) => {
                        if (p.type === 'keywords' && Array.isArray(p.keywords)) {
                          return p.keywords.join(' ');
                        }
                        return '';
                      })
                      .filter(Boolean)
                      .join(' ');
                  }
                } catch (_e) {
                  // Not JSON or parsing failed, keep original
                }
              }

              const existing = await db.menuItems.get(item.id);
              if (!existing || item.updatedAt > existing.updatedAt) {
                await db.menuItems.put({
                  ...item,
                  target: normalizedTarget,
                });
                stats.success++;
              } else {
                stats.skipped++;
              }
            } else {
              stats.skipped++;
              stats.errors.push(
                `Menu item ${item.name} skipped: associated notebook ${item.notebookId} not found.`,
              );
            }
          }
        }

        // 5. Process NoteTags
        if (data.noteTags) {
          for (const nt of data.noteTags) {
            const note = importedNoteIds.has(nt.noteId)
              ? await db.notes.get(nt.noteId)
              : await db.notes.get(nt.noteId);
            const tagExists = importedTagIds.has(nt.tagId) || (await db.tags.get(nt.tagId));

            if (note && tagExists) {
              await db.noteTags.put({
                ...nt,
                notebookId: nt.notebookId || note.notebookId,
              });
              stats.success++;
            } else {
              stats.skipped++;
            }
          }
        }
      },
    );

    return stats;
  },
};
