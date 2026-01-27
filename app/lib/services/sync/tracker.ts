import type { Transaction } from 'dexie';
import {
  type AppTableName,
  generateId,
  SYNCABLE_TABLES,
  type SyncableTableName,
  TABLE_NAMES,
  type TimenoteDatabase,
} from '~/lib/db';
import type { Notebook, NoteTag, SyncEvent } from '~/lib/types';

const logSyncEvent = (
  db: TimenoteDatabase,
  transaction: Transaction,
  notebookId: string,
  entityName: SyncableTableName,
  entityId: string,
  action: 'create' | 'update' | 'delete',
) => {
  const event: SyncEvent = {
    id: generateId(),
    notebookId,
    entityName,
    entityId,
    action,
    createdAt: Date.now(),
  };

  const SYNC_EVENTS_TABLE: AppTableName = TABLE_NAMES.SYNC_EVENTS;

  let hasSyncEvents = false;
  try {
    transaction.table(SYNC_EVENTS_TABLE);
    hasSyncEvents = true;
  } catch (_e) {
    hasSyncEvents = false;
  }

  if (hasSyncEvents) {
    transaction.table(SYNC_EVENTS_TABLE).add(event);
  } else {
    db.syncEvents.add(event).catch((err: Error) => {
      console.error(`Failed to log sync event for ${entityName} ${action}:`, err);
    });
  }
};

export const initSyncTracker = (db: TimenoteDatabase) => {
  SYNCABLE_TABLES.forEach((tableName: SyncableTableName) => {
    db.table(tableName).hook('creating', (primKey, obj, transaction: Transaction) => {
      if ((transaction as any).source === 'sync') return;

      let entityId = String(primKey);
      if (tableName === TABLE_NAMES.NOTE_TAGS) {
        const nt = obj as NoteTag;
        entityId = `${nt.noteId}:${nt.tagId}`;
      }

      let notebookId = (obj as any).notebookId;
      if (tableName === TABLE_NAMES.NOTEBOOKS) {
        notebookId = (obj as Notebook).id;
      }

      if (notebookId) {
        logSyncEvent(db, transaction, notebookId, tableName, entityId, 'create');
      }
    });

    db.table(tableName).hook('updating', (_mods, primKey, obj, transaction: Transaction) => {
      if ((transaction as any).source === 'sync') return;

      let entityId = String(primKey);
      if (tableName === TABLE_NAMES.NOTE_TAGS) {
        const nt = obj as NoteTag;
        entityId = `${nt.noteId}:${nt.tagId}`;
      }

      let notebookId = (obj as any).notebookId;
      if (tableName === TABLE_NAMES.NOTEBOOKS) {
        notebookId = (obj as Notebook).id;
      }

      if (notebookId) {
        logSyncEvent(db, transaction, notebookId, tableName, entityId, 'update');
      }
    });

    db.table(tableName).hook('deleting', (primKey, obj, transaction: Transaction) => {
      if ((transaction as any).source === 'sync') return;

      let entityId = String(primKey);
      if (tableName === TABLE_NAMES.NOTE_TAGS) {
        const nt = obj as NoteTag;
        entityId = `${nt.noteId}:${nt.tagId}`;
      }

      let notebookId = (obj as any).notebookId;
      if (tableName === TABLE_NAMES.NOTEBOOKS) {
        notebookId = (obj as Notebook).id;
      }

      if (notebookId) {
        logSyncEvent(db, transaction, notebookId, tableName, entityId, 'delete');
      }
    });
  });
};
