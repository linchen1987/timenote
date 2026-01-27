import { db, type SyncableTableName, TABLE_NAMES } from '~/lib/db';
import type { BackupData, DataApplyResult, SyncableEntity } from '~/lib/services/sync/types';
import type { MenuItem as MenuItemType, Note, NoteTag, SyncEvent, Tag } from '~/lib/types';
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
            const normalizedTarget = parsed
              .map((p: any) => {
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
    const totalResult: DataApplyResult = { success: 0, skipped: 0, errors: [] };

    await db.transaction(
      'rw',
      [db.notebooks, db.notes, db.tags, db.noteTags, db.menuItems, db.syncEvents],
      async (transaction) => {
        (transaction as any).source = 'sync';

        const syncEvents = options.notebookId
          ? await db.syncEvents.where('notebookId').equals(options.notebookId).toArray()
          : [];

        const knownNotebookIds = new Set<string>();
        const notebookExists = async (id: string) => {
          if (knownNotebookIds.has(id)) return true;
          return (await db.notebooks.where('id').equals(id).count()) > 0;
        };

        const processTable = async (tableName: SyncableTableName, remoteList: SyncableEntity[]) => {
          const table = db.table(tableName);
          const localList = options.notebookId
            ? tableName === TABLE_NAMES.NOTEBOOKS
              ? await db.notebooks.where('id').equals(options.notebookId).toArray()
              : await table.where('notebookId').equals(options.notebookId).toArray()
            : await table.toArray();

          const res = await this.applyEntities(tableName, remoteList, localList, {
            syncEvents,
            notebookExists: tableName !== TABLE_NAMES.NOTEBOOKS ? notebookExists : undefined,
          });

          if (tableName === TABLE_NAMES.NOTEBOOKS) {
            remoteList.forEach((nb) => knownNotebookIds.add(getEntitySyncId(tableName, nb)));
          }

          totalResult.success += res.success;
          totalResult.skipped += res.skipped;
          totalResult.errors.push(...res.errors);
        };

        await processTable(TABLE_NAMES.NOTEBOOKS, data.notebooks || []);
        await processTable(TABLE_NAMES.TAGS, data.tags || []);
        await processTable(TABLE_NAMES.NOTES, data.notes || []);
        await processTable(TABLE_NAMES.MENU_ITEMS, data.menuItems || []);
        await processTable(TABLE_NAMES.NOTE_TAGS, data.noteTags || []);
      },
    );

    return totalResult;
  },

  /**
   * Generic method to apply remote entities to local database.
   */
  async applyEntities(
    tableName: SyncableTableName,
    remoteList: SyncableEntity[],
    localList: SyncableEntity[],
    options: {
      syncEvents?: SyncEvent[];
      notebookExists?: (id: string) => Promise<boolean> | boolean;
    },
  ): Promise<DataApplyResult> {
    const result: DataApplyResult = { success: 0, skipped: 0, errors: [] };
    const remoteMap = new Map(remoteList.map((i) => [getEntitySyncId(tableName, i), i]));
    const localMap = new Map(localList.map((i) => [getEntitySyncId(tableName, i), i]));
    const events = options.syncEvents || [];

    // 1. Remote -> Local
    for (const rawRItem of remoteList) {
      const rItem = this.prepareEntityForStorage(tableName, rawRItem);
      const rId = getEntitySyncId(tableName, rItem);
      const lItem = localMap.get(rId);

      if (options.notebookExists && tableName !== TABLE_NAMES.NOTEBOOKS) {
        const nbId = (rItem as any).notebookId;
        if (nbId && !(await options.notebookExists(nbId))) {
          result.skipped++;
          continue;
        }
      }

      if (lItem) {
        if ('updatedAt' in rItem && 'updatedAt' in lItem) {
          if ((rItem as any).updatedAt > (lItem as any).updatedAt) {
            await db.table(tableName).put(rItem);
            result.success++;
          } else {
            result.skipped++;
          }
        } else {
          await db.table(tableName).put(rItem);
          result.success++;
        }
      } else {
        const deletedLocally = events.some(
          (e) => e.entityId === rId && e.action === 'delete' && e.entityName === tableName,
        );

        if (!deletedLocally) {
          await db.table(tableName).put(rItem);
          result.success++;
        } else {
          result.skipped++;
        }
      }
    }

    // 2. Local -> Delete
    for (const lItem of localList) {
      const lId = getEntitySyncId(tableName, lItem);
      if (!remoteMap.has(lId)) {
        const createdLocally = events.some(
          (e) => e.entityId === lId && e.action === 'create' && e.entityName === tableName,
        );

        if (!createdLocally) {
          if (tableName === TABLE_NAMES.NOTE_TAGS) {
            const nt = lItem as NoteTag;
            await db.noteTags.delete([nt.noteId, nt.tagId]);
          } else {
            await db.table(tableName).delete(lId);
          }
        }
      }
    }

    return result;
  },
};
