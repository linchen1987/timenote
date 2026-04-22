import { type SyncableTableName, TABLE_NAMES } from '../../db';
import type { Notebook, NoteTag } from '../../types';
import type { SyncableEntity } from './types';

export const getEntitySyncId = (tableName: SyncableTableName, entity: SyncableEntity): string => {
  if (tableName === TABLE_NAMES.NOTE_TAGS) {
    const nt = entity as NoteTag;
    return `${nt.noteId}:${nt.tagId}`;
  }
  return (entity as { id: string }).id;
};

export const getEntityNotebookId = (
  tableName: SyncableTableName,
  entity: SyncableEntity,
): string => {
  if (tableName === TABLE_NAMES.NOTEBOOKS) {
    return (entity as Notebook).id;
  }
  return (entity as { notebookId: string }).notebookId;
};
