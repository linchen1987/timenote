import { db, type SyncableTableName, TABLE_NAMES } from '~/lib/db';
import { WebDAVService } from '~/lib/services/webdav-service';
import { type BackupData, SYNC_ROOT_PATH, type SyncableEntity } from './types';
import { getEntitySyncId } from './utils';

export const SyncService = {
  async init() {
    if (!(await WebDAVService.exists(SYNC_ROOT_PATH))) {
      await WebDAVService.mkdir(SYNC_ROOT_PATH);
    }
  },

  async getRemoteNotebooks() {
    if (!(await WebDAVService.exists(SYNC_ROOT_PATH))) return [];

    try {
      const list = await WebDAVService.list(SYNC_ROOT_PATH);
      const notebooks = [];

      for (const item of list) {
        if (item.type === 'directory' && item.basename.startsWith('nb_')) {
          const parts = item.basename.split('_');
          const id = parts[1];
          if (!id) continue;

          let name = item.basename;
          try {
            const dataStr = await WebDAVService.read(`${item.filename}/data.json`);
            const data = JSON.parse(dataStr) as BackupData;
            if (data.notebooks && data.notebooks.length > 0) {
              name = data.notebooks[0].name;
            }
          } catch (_e) {
            // console.warn(`Failed to read metadata for ${item.basename}`, e);
          }

          notebooks.push({
            id,
            name,
            path: item.filename,
          });
        }
      }
      return notebooks;
    } catch (e) {
      console.error('Failed to list remote notebooks', e);
      return [];
    }
  },

  async syncNotebook(notebookId: string) {
    await SyncService.init();
    const notebookPath = `${SYNC_ROOT_PATH}/nb_${notebookId}`;
    if (!(await WebDAVService.exists(notebookPath))) {
      await WebDAVService.mkdir(notebookPath);
    }

    await SyncService.pull(notebookId);
    await SyncService.push(notebookId);
  },

  async pull(notebookId: string) {
    const dataPath = `${SYNC_ROOT_PATH}/nb_${notebookId}/data.json`;
    let remoteData: BackupData | null = null;
    try {
      const content = await WebDAVService.read(dataPath);
      remoteData = JSON.parse(content);
    } catch (_e) {
      // console.log("No remote data found, skipping pull logic");
    }

    if (!remoteData) return;

    await db.transaction(
      'rw',
      [db.notebooks, db.notes, db.tags, db.noteTags, db.menuItems, db.syncEvents],
      async (transaction) => {
        (transaction as any).source = 'sync';
        const events = await db.syncEvents.where('notebookId').equals(notebookId).toArray();

        const processEntity = async (
          tableName: SyncableTableName,
          remoteList: SyncableEntity[] = [],
          localList: SyncableEntity[] = [],
        ) => {
          const remoteMap = new Map(remoteList.map((i) => [getEntitySyncId(tableName, i), i]));
          const localMap = new Map(localList.map((i) => [getEntitySyncId(tableName, i), i]));

          // 1. Remote -> Local
          for (const rItem of remoteList) {
            const rId = getEntitySyncId(tableName, rItem);
            const lItem = localMap.get(rId);

            if (lItem) {
              // Update check
              if ('updatedAt' in rItem && 'updatedAt' in lItem) {
                const rTime = (rItem as any).updatedAt || 0;
                const lTime = (lItem as any).updatedAt || 0;
                if (rTime > lTime) {
                  await db.table(tableName).put(rItem);
                }
              } else {
                // For items without updatedAt (like Tags and NoteTags),
                // we put to ensure local data matches remote if there's any discrepancy
                await db.table(tableName).put(rItem);
              }
            } else {
              // Check if deleted locally
              const deleted = events.some(
                (e) => e.entityId === rId && e.action === 'delete' && e.entityName === tableName,
              );
              if (!deleted) {
                await db.table(tableName).put(rItem);
              }
            }
          }

          // 2. Local -> Check deletion
          for (const lItem of localList) {
            const lId = getEntitySyncId(tableName, lItem);
            if (!remoteMap.has(lId)) {
              // Check if created locally
              const created = events.some(
                (e) => e.entityId === lId && e.action === 'create' && e.entityName === tableName,
              );
              if (!created) {
                // Deleted remotely
                if (tableName === TABLE_NAMES.NOTE_TAGS) {
                  const nt = lItem as any;
                  await db.noteTags.delete([nt.noteId, nt.tagId]);
                } else {
                  await db.table(tableName).delete(lId);
                }
              }
            }
          }
        };

        // 1. Notebooks
        const localNotebooks = await db.notebooks.where('id').equals(notebookId).toArray();
        await processEntity(TABLE_NAMES.NOTEBOOKS, remoteData.notebooks, localNotebooks);

        // 2. Notes
        const localNotes = await db.notes.where('notebookId').equals(notebookId).toArray();
        await processEntity(TABLE_NAMES.NOTES, remoteData.notes, localNotes);

        // 3. Tags
        const localTags = await db.tags.where('notebookId').equals(notebookId).toArray();
        await processEntity(TABLE_NAMES.TAGS, remoteData.tags, localTags);

        // 4. MenuItems
        const localMenuItems = await db.menuItems.where('notebookId').equals(notebookId).toArray();
        await processEntity(TABLE_NAMES.MENU_ITEMS, remoteData.menuItems, localMenuItems);

        // 5. NoteTags
        const localNoteTags = await db.noteTags.where('notebookId').equals(notebookId).toArray();
        await processEntity(TABLE_NAMES.NOTE_TAGS, remoteData.noteTags, localNoteTags);
      },
    );
  },

  async push(notebookId: string) {
    const notebooks = await db.notebooks.where('id').equals(notebookId).toArray();
    if (notebooks.length === 0) return;

    const notes = await db.notes.where('notebookId').equals(notebookId).toArray();
    const tags = await db.tags.where('notebookId').equals(notebookId).toArray();
    const menuItems = await db.menuItems.where('notebookId').equals(notebookId).toArray();
    const noteTags = await db.noteTags.where('notebookId').equals(notebookId).toArray();

    const data: BackupData = {
      version: 1,
      exportedAt: Date.now(),
      notebooks,
      notes,
      tags,
      noteTags,
      menuItems,
    };

    const content = JSON.stringify(data);
    const path = `${SYNC_ROOT_PATH}/nb_${notebookId}/data.json`;

    await WebDAVService.write(path, content);

    await db.syncEvents.where('notebookId').equals(notebookId).delete();
  },
};
