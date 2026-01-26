import Dexie, { type Table } from 'dexie';
import { nanoid } from 'nanoid';
import type { MenuItem, Note, Notebook, NoteTag, SyncEvent, Tag } from '~/lib/types';

export const generateId = () => nanoid(12);

export class TimenoteDatabase extends Dexie {
  notebooks!: Table<Notebook>;
  notes!: Table<Note>;
  tags!: Table<Tag>;
  noteTags!: Table<NoteTag>;
  menuItems!: Table<MenuItem>;
  syncEvents!: Table<SyncEvent>;

  constructor() {
    super('TimenoteDB');
    this.version(5).stores({
      notebooks: 'id, name, createdAt, updatedAt',
      notes: 'id, notebookId, createdAt, updatedAt, [notebookId+updatedAt]',
      tags: 'id, notebookId, name',
      noteTags: '[noteId+tagId], noteId, tagId',
      menuItems: 'id, notebookId, parentId, order',
      syncEvents: 'id, notebookId, createdAt, [notebookId+createdAt]',
    });

    // Add hooks for tracking changes
    this.addHooks();
  }

  addHooks() {
    const tables = ['notebooks', 'notes', 'tags', 'menuItems', 'noteTags'] as const;

    tables.forEach((tableName) => {
      this.table(tableName).hook('creating', (primKey, obj, transaction) => {
        if ((transaction as any).source === 'sync') return;

        // For noteTags, primKey might be an array or object depending on schema, but we use composite key string for event
        let entityId = String(primKey);
        if (tableName === 'noteTags') {
          const nt = obj as NoteTag;
          entityId = `${nt.noteId}:${nt.tagId}`;
        }

        let notebookId = (obj as any).notebookId;
        // For notebook entity itself, id is the notebookId
        if (tableName === 'notebooks') {
          notebookId = (obj as Notebook).id;
        }

        if (notebookId) {
          this.logSyncEvent(transaction, notebookId, tableName, entityId, 'create');
        } else if (tableName === 'noteTags') {
          // For noteTags, we need to find the notebookId from the note or tag.
          const noteId = (obj as NoteTag).noteId;
          let noteTable;
          try {
            noteTable = transaction.table('notes');
          } catch (_e) {
            noteTable = this.notes;
          }

          noteTable.get(noteId).then((note: Note) => {
            if (note) {
              this.logSyncEvent(transaction, note.notebookId, tableName, entityId, 'create');
            }
          });
        }
      });

      this.table(tableName).hook('updating', (_mods, primKey, obj, transaction) => {
        if ((transaction as any).source === 'sync') return;

        let entityId = String(primKey);
        if (tableName === 'noteTags') {
          const nt = obj as NoteTag;
          entityId = `${nt.noteId}:${nt.tagId}`;
        }

        let notebookId = (obj as any).notebookId;
        if (tableName === 'notebooks') {
          notebookId = (obj as Notebook).id;
        }

        if (notebookId) {
          this.logSyncEvent(transaction, notebookId, tableName, entityId, 'update');
        } else if (tableName === 'noteTags') {
          let noteTable;
          try {
            noteTable = transaction.table('notes');
          } catch (_e) {
            noteTable = this.notes;
          }
          noteTable.get((obj as NoteTag).noteId).then((note: Note) => {
            if (note) {
              this.logSyncEvent(transaction, note.notebookId, tableName, entityId, 'update');
            }
          });
        }
      });

      this.table(tableName).hook('deleting', (primKey, obj, transaction) => {
        if ((transaction as any).source === 'sync') return;

        let entityId = String(primKey);
        if (tableName === 'noteTags') {
          const nt = obj as NoteTag;
          entityId = `${nt.noteId}:${nt.tagId}`;
        }

        let notebookId = (obj as any).notebookId;
        if (tableName === 'notebooks') {
          notebookId = (obj as Notebook).id;
        }

        if (notebookId) {
          this.logSyncEvent(transaction, notebookId, tableName, entityId, 'delete');
        } else if (tableName === 'noteTags') {
          let noteTable;
          try {
            noteTable = transaction.table('notes');
          } catch (_e) {
            noteTable = this.notes;
          }
          noteTable.get((obj as NoteTag).noteId).then((note: Note) => {
            if (note) {
              this.logSyncEvent(transaction, note.notebookId, tableName, entityId, 'delete');
            }
          });
        }
      });
    });
  }

  logSyncEvent(
    transaction: any,
    notebookId: string,
    entityName: string,
    entityId: string,
    action: 'create' | 'update' | 'delete',
  ) {
    // Add event to syncEvents table
    // We use a unique ID for the event
    const event: SyncEvent = {
      id: generateId(),
      notebookId,
      entityName,
      entityId,
      action,
      createdAt: Date.now(),
    };

    // We must use the transaction to write if syncEvents is part of it
    let hasSyncEvents = false;
    try {
      transaction.table('syncEvents');
      hasSyncEvents = true;
    } catch (_e) {
      hasSyncEvents = false;
    }

    if (hasSyncEvents) {
      transaction.table('syncEvents').add(event);
    } else {
      // Fallback to direct table access if not in transaction
      // Note: This won't be atomic with the main operation
      this.syncEvents.add(event).catch((err) => {
        console.error(`Failed to log sync event for ${entityName} ${action}:`, err);
      });
    }
  }
}

export const db = new TimenoteDatabase();
