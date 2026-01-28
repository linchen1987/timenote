import type { Transaction } from 'dexie';
import { db } from '~/lib/db';

export interface DataToolsProgress {
  status: string;
  progress?: number;
}

export type DataToolsStatusCallback = (progress: DataToolsProgress) => void;

export const DataToolsService = {
  async migrateNoteTags(notebookId?: string, onProgress?: DataToolsStatusCallback): Promise<void> {
    const allNoteTags = notebookId
      ? await db.noteTags.where('notebookId').equals(notebookId).toArray()
      : await db.noteTags.toArray();
    const total = allNoteTags.length;

    if (total === 0) {
      onProgress?.({ status: 'No records to process.' });
      return;
    }

    onProgress?.({ status: `Found ${total} records. Starting update...` });

    let processed = 0;

    await db.transaction(
      'rw',
      [db.noteTags, db.notes],
      async (tx: Transaction & { source?: string }) => {
        tx.source = 'sync';

        for (const nt of allNoteTags) {
          if (!nt.notebookId) {
            const note = await db.notes.get(nt.noteId);
            if (note) {
              if (!notebookId || note.notebookId === notebookId) {
                await db.noteTags.where({ noteId: nt.noteId, tagId: nt.tagId }).modify({
                  notebookId: note.notebookId,
                });
              }
            }
          }
          processed++;
          if (processed % 10 === 0 || processed === total) {
            onProgress?.({
              status: `Processed ${processed}/${total}...`,
              progress: Math.round((processed / total) * 100),
            });
          }
        }
      },
    );

    onProgress?.({ status: 'Task completed successfully!' });
  },

  async clearSyncEvents(notebookId?: string, onProgress?: DataToolsStatusCallback): Promise<void> {
    onProgress?.({ status: '' });

    if (notebookId) {
      await db.syncEvents.where('notebookId').equals(notebookId).delete();
      onProgress?.({ status: 'All syncEvents for this notebook cleared successfully!' });
    } else {
      await db.syncEvents.clear();
      onProgress?.({ status: 'All syncEvents cleared successfully!' });
    }
  },

  async pruneTags(notebookId?: string, onProgress?: DataToolsStatusCallback): Promise<void> {
    onProgress?.({ status: 'Finding orphaned tags...' });

    const allTags = notebookId
      ? await db.tags.where('notebookId').equals(notebookId).toArray()
      : await db.tags.toArray();
    const total = allTags.length;

    if (total === 0) {
      onProgress?.({ status: 'No tags to process.' });
      return;
    }

    const tagIdsWithNotes = new Set(
      notebookId
        ? (await db.noteTags.where('notebookId').equals(notebookId).toArray()).map((nt) => nt.tagId)
        : (await db.noteTags.toArray()).map((nt) => nt.tagId),
    );

    const orphanedTags = allTags.filter((tag) => !tagIdsWithNotes.has(tag.id));

    if (orphanedTags.length === 0) {
      onProgress?.({ status: 'No orphaned tags found. All tags are in use.' });
      return;
    }

    onProgress?.({ status: `Found ${orphanedTags.length} orphaned tags. Deleting...` });

    await db.transaction('rw', [db.tags], async () => {
      for (const tag of orphanedTags) {
        await db.tags.delete(tag.id);
      }
    });

    onProgress?.({ status: `Successfully deleted ${orphanedTags.length} orphaned tags!` });
  },
};
