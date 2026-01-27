import { db } from '~/lib/db';
import { WebDAVService } from '~/lib/services/webdav-service';
import { DataService } from '../data-service';
import { type BackupData, SYNC_ROOT_PATH } from './types';

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

    await DataService.applyBackupData(remoteData, {
      notebookId,
    });
  },

  async push(notebookId: string) {
    const data = await DataService.fetchBackupData(notebookId);

    const content = JSON.stringify(data);
    const path = `${SYNC_ROOT_PATH}/nb_${notebookId}/data.json`;

    await WebDAVService.write(path, content);

    await db.syncEvents.where('notebookId').equals(notebookId).delete();
  },
};
