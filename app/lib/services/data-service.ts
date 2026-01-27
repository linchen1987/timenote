import type { Transaction } from 'dexie';
import { db, type SyncableTableName, TABLE_NAMES } from '~/lib/db';
import type { BackupData, DataApplyResult, SyncableEntity } from '~/lib/services/sync/types';
import type { MenuItem as MenuItemType, NoteTag } from '~/lib/types';
import { getEntitySyncId } from './sync/utils';

export const DataService = {
  /**
   * Gathers data for backup or sync.
   */
  async fetchBackupData(notebookId?: string): Promise<BackupData> {
    if (notebookId) {
      const [notebooks, notes, tags, menuItems, noteTags] = await Promise.all([
        db.notebooks.where('id').equals(notebookId).toArray(),
        db.notes.where('notebookId').equals(notebookId).toArray(),
        db.tags.where('notebookId').equals(notebookId).toArray(),
        db.menuItems.where('notebookId').equals(notebookId).toArray(),
        db.noteTags.where('notebookId').equals(notebookId).toArray(),
      ]);

      return {
        notebooks,
        notes,
        tags,
        menuItems,
        noteTags,
        version: 1,
        exportedAt: Date.now(),
      };
    }

    const [notebooks, notes, tags, menuItems, noteTags] = await Promise.all([
      db.notebooks.toArray(),
      db.notes.toArray(),
      db.tags.toArray(),
      db.menuItems.toArray(),
      db.noteTags.toArray(),
    ]);

    return {
      notebooks,
      notes,
      tags,
      menuItems,
      noteTags,
      version: 1,
      exportedAt: Date.now(),
    };
  },

  /**
   * Normalizes and prepares an entity for storage.
   */
  prepareEntityForStorage<T extends SyncableEntity>(tableName: SyncableTableName, entity: T): T {
    if (tableName === TABLE_NAMES.MENU_ITEMS) {
      const item = entity as MenuItemType;
      if (item.type === 'search' && item.target.startsWith('[')) {
        try {
          const parsed = JSON.parse(item.target);
          if (Array.isArray(parsed)) {
            const normalizedTarget = (parsed as { type?: string; keywords?: string[] }[])
              .map((p) => {
                if (p.type === 'keywords' && Array.isArray(p.keywords)) {
                  return p.keywords.join(' ');
                }
                return '';
              })
              .filter(Boolean)
              .join(' ');
            return { ...item, target: normalizedTarget } as T;
          }
        } catch (_e) {}
      }
    }
    return entity;
  },

  /**
   * Orchestrates the application of BackupData to the local database.
   */
  async applyBackupData(
    data: BackupData,
    options: { notebookId?: string } = {},
  ): Promise<DataApplyResult> {
    console.log('[applyBackupData] Starting');
    const totalResult: DataApplyResult = { success: 0, skipped: 0, errors: [] };

    const addError = (message: string) => {
      totalResult.errors.push(message);
      console.error('applyBackupData:', message);
    };

    try {
      console.log('[applyBackupData] Fetching sync events');
      const syncEvents = options.notebookId
        ? await db.syncEvents.where('notebookId').equals(options.notebookId).toArray()
        : [];

      console.log('[applyBackupData] Starting transaction');
      await db.transaction(
        'rw',
        [db.notebooks, db.notes, db.tags, db.noteTags, db.menuItems],
        async (transaction: Transaction & { source?: string }) => {
          transaction.source = 'sync';

          // Pre-fetch all notebook IDs to avoid async checks in loops
          const validNotebookIds = new Set<string>(
            (await db.notebooks.toCollection().primaryKeys()) as string[],
          );

          const tables: Array<{ name: SyncableTableName; data: SyncableEntity[] }> = [
            { name: TABLE_NAMES.NOTEBOOKS, data: data.notebooks || [] },
            { name: TABLE_NAMES.TAGS, data: data.tags || [] },
            { name: TABLE_NAMES.NOTES, data: data.notes || [] },
            { name: TABLE_NAMES.MENU_ITEMS, data: data.menuItems || [] },
            { name: TABLE_NAMES.NOTE_TAGS, data: data.noteTags || [] },
          ];

          for (const { name, data: remoteList } of tables) {
            try {
              console.log(
                `[applyBackupData] Processing table: ${name}, count: ${remoteList.length}`,
              );

              const localList = options.notebookId
                ? name === TABLE_NAMES.NOTEBOOKS
                  ? await db.notebooks.where('id').equals(options.notebookId).toArray()
                  : await db.table(name).where('notebookId').equals(options.notebookId).toArray()
                : await db.table(name).toArray();

              const remoteMap = new Map<string, SyncableEntity>();
              for (const item of remoteList) {
                try {
                  remoteMap.set(getEntitySyncId(name, item), item);
                } catch (e) {
                  addError(
                    `[${name}] Failed to map remote ID: ${e instanceof Error ? e.message : 'Unknown error'}`,
                  );
                }
              }

              const localMap = new Map<string, SyncableEntity>();
              for (const item of localList) {
                try {
                  localMap.set(getEntitySyncId(name, item), item);
                } catch (e) {
                  addError(
                    `[${name}] Failed to map local ID: ${e instanceof Error ? e.message : 'Unknown error'}`,
                  );
                }
              }

              let tableSuccess = 0;
              let tableSkipped = 0;

              for (const rawRItem of remoteList) {
                try {
                  const rItem = this.prepareEntityForStorage(name, rawRItem);
                  const rId = getEntitySyncId(name, rItem);
                  const lItem = localMap.get(rId);

                  if (name !== TABLE_NAMES.NOTEBOOKS) {
                    const nbId = (rItem as { notebookId?: string }).notebookId;
                    if (nbId && !validNotebookIds.has(nbId)) {
                      tableSkipped++;
                      continue;
                    }
                  }

                  if (lItem) {
                    if ('updatedAt' in rItem && 'updatedAt' in lItem) {
                      const rUpdatedAt = (rItem as { updatedAt: number }).updatedAt;
                      const lUpdatedAt = (lItem as { updatedAt: number }).updatedAt;
                      if (rUpdatedAt > lUpdatedAt) {
                        await db.table(name).put(rItem);
                        tableSuccess++;
                      } else {
                        tableSkipped++;
                      }
                    } else {
                      await db.table(name).put(rItem);
                      tableSuccess++;
                    }
                  } else {
                    const deletedLocally = syncEvents.some(
                      (e) => e.entityId === rId && e.action === 'delete' && e.entityName === name,
                    );
                    if (!deletedLocally) {
                      await db.table(name).put(rItem);
                      if (name === TABLE_NAMES.NOTEBOOKS) {
                        validNotebookIds.add(rId);
                      }
                      tableSuccess++;
                    } else {
                      tableSkipped++;
                    }
                  }
                } catch (e) {
                  addError(
                    `[${name}] Failed to process item: ${e instanceof Error ? e.message : 'Unknown error'}`,
                  );
                }
              }

              for (const lItem of localList) {
                try {
                  const lId = getEntitySyncId(name, lItem);
                  if (!remoteMap.has(lId)) {
                    const createdLocally = syncEvents.some(
                      (e) => e.entityId === lId && e.action === 'create' && e.entityName === name,
                    );
                    if (!createdLocally) {
                      if (name === TABLE_NAMES.NOTE_TAGS) {
                        const nt = lItem as NoteTag;
                        await db.noteTags.delete([nt.noteId, nt.tagId]);
                      } else {
                        await db.table(name).delete(lId);
                        if (name === TABLE_NAMES.NOTEBOOKS) {
                          validNotebookIds.delete(lId);
                        }
                      }
                    }
                  }
                } catch (e) {
                  addError(
                    `[${name}] Failed to delete item: ${e instanceof Error ? e.message : 'Unknown error'}`,
                  );
                }
              }

              totalResult.success += tableSuccess;
              totalResult.skipped += tableSkipped;
              console.log(`[applyBackupData] Completed ${name}: ${tableSuccess}, ${tableSkipped}`);
            } catch (e) {
              addError(
                `[${name}] Processing failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
              );
            }
          }
        },
      );

      console.log('[applyBackupData] Transaction completed');
    } catch (e) {
      addError(`Transaction failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    return totalResult;
  },
};
