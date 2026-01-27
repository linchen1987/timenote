import type { Transaction } from 'dexie';
import {
  type AppTableName,
  generateId,
  SYNCABLE_TABLES,
  type SyncableTableName,
  TABLE_NAMES,
  type TimenoteDatabase,
} from '~/lib/db';
import type { SyncEvent } from '~/lib/types';
import type { SyncableEntity } from './types';
import { getEntityNotebookId, getEntitySyncId } from './utils';

const logSyncEvent = (
  db: TimenoteDatabase,
  transaction: Transaction & { source?: string },
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
    // Don't attempt to add sync event if it's not part of the transaction
    // This prevents the NotFoundError during sync operations
    if (transaction.source !== 'sync') {
      db.syncEvents.add(event).catch((err: Error) => {
        console.error(`Failed to log sync event for ${entityName} ${action}:`, err);
      });
    }
  }
};

const handleHook = (
  db: TimenoteDatabase,
  tableName: SyncableTableName,
  action: 'create' | 'update' | 'delete',
  obj: SyncableEntity,
  transaction: Transaction & { source?: string },
) => {
  if (transaction.source === 'sync') return;

  const entityId = getEntitySyncId(tableName, obj);
  const notebookId = getEntityNotebookId(tableName, obj);

  if (notebookId) {
    logSyncEvent(db, transaction, notebookId, tableName, entityId, action);
  }
};

export const initSyncTracker = (db: TimenoteDatabase) => {
  SYNCABLE_TABLES.forEach((tableName) => {
    db.table(tableName).hook('creating', (_primKey, obj, transaction) => {
      handleHook(db, tableName, 'create', obj as SyncableEntity, transaction);
    });

    db.table(tableName).hook('updating', (_mods, _primKey, obj, transaction) => {
      handleHook(db, tableName, 'update', obj as SyncableEntity, transaction);
    });

    db.table(tableName).hook('deleting', (_primKey, obj, transaction) => {
      handleHook(db, tableName, 'delete', obj as SyncableEntity, transaction);
    });
  });
};
