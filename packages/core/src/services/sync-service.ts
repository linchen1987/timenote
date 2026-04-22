import { db } from '../db';
import type { FsService } from '../fs/fs-service';
import { DataService } from './data-service';
import { type BackupData, SYNC_ROOT_PATH } from './sync/types';

export function createSyncService(fsService: FsService) {
  let isInitialized = false;

  return {
    async init() {
      if (isInitialized) return;
      await fsService.ensureDir(SYNC_ROOT_PATH);
      isInitialized = true;
    },

    async getRemoteNotebooks() {
      try {
        const list = await fsService.list(SYNC_ROOT_PATH);
        const notebooks = [];

        for (const item of list) {
          if (item.type === 'directory' && item.basename.startsWith('nb_')) {
            const parts = item.basename.split('_');
            const id = parts[1];
            if (!id) continue;

            let name = item.basename;
            try {
              const dataStr = await fsService.read(`${item.filename}/data.json`);
              const data = JSON.parse(dataStr) as BackupData;
              if (data.notebooks && data.notebooks.length > 0) {
                name = data.notebooks[0].name;
              }
            } catch (_e) {}

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
      await this.init();
      const notebookPath = `${SYNC_ROOT_PATH}/nb_${notebookId}`;
      await fsService.ensureDir(notebookPath);

      await this.pull(notebookId);
      await this.push(notebookId);
    },

    async restoreNotebook(notebookId: string) {
      await db.syncEvents.where('notebookId').equals(notebookId).delete();
      await this.pull(notebookId);
    },

    async pull(notebookId: string) {
      const dataPath = `${SYNC_ROOT_PATH}/nb_${notebookId}/data.json`;
      let remoteData: BackupData | null = null;
      try {
        const content = await fsService.read(dataPath);
        remoteData = JSON.parse(content);
      } catch (_e) {}

      if (!remoteData) return;

      const result = await DataService.applyBackupData(remoteData, {
        notebookId,
      });

      if (result.errors.length > 0) {
        throw new Error(
          `Pull completed with ${result.errors.length} error(s): ${result.errors.join(', ')}`,
        );
      }
    },

    async push(notebookId: string) {
      await this.init();
      const notebookPath = `${SYNC_ROOT_PATH}/nb_${notebookId}`;
      await fsService.ensureDir(notebookPath);

      const data = await DataService.fetchBackupData(notebookId);

      const content = JSON.stringify(data);
      const path = `${SYNC_ROOT_PATH}/nb_${notebookId}/data.json`;

      await fsService.write(path, content);

      await db.syncEvents.where('notebookId').equals(notebookId).delete();
    },
  };
}

export type SyncServiceInstance = ReturnType<typeof createSyncService>;
