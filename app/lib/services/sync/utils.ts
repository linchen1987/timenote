import { type SyncableTableName, TABLE_NAMES } from '~/lib/db';
import type { Notebook, NoteTag } from '~/lib/types';
import type { SyncableEntity } from './types';

/**
 * Extracts a unique string ID for any syncable entity.
 * Handles composite keys (like noteTags) by converting them to a consistent string format.
 */
export const getEntitySyncId = (tableName: SyncableTableName, entity: SyncableEntity): string => {
  if (tableName === TABLE_NAMES.NOTE_TAGS) {
    const nt = entity as NoteTag;
    return `${nt.noteId}:${nt.tagId}`;
  }
  // All other syncable entities have a single 'id' property
  return (entity as any).id;
};

/**
 * Gets the notebook ID that an entity belongs to.
 */
export const getEntityNotebookId = (
  tableName: SyncableTableName,
  entity: SyncableEntity,
): string => {
  if (tableName === TABLE_NAMES.NOTEBOOKS) {
    return (entity as Notebook).id;
  }
  // Note, Tag, MenuItem, NoteTag all have notebookId
  return (entity as any).notebookId;
};
