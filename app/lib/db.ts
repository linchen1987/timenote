import Dexie, { type Table } from 'dexie';
import { nanoid } from 'nanoid';

export const generateId = () => nanoid(12);

export interface Notebook {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  notebookId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  notebookId: string;
  name: string;
  createdAt: number;
}

export interface NoteTag {
  noteId: string;
  tagId: string;
}

export interface MenuItem {
  id: string;
  notebookId: string;
  parentId: string | null;
  name: string;
  type: 'note' | 'search';
  target: string; // noteId or search query
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface SyncEvent {
  id: string;
  notebookId: string;
  entityName: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  createdAt: number;
}

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
      syncEvents: 'id, notebookId, createdAt, [notebookId+createdAt]'
    });

    // Add hooks for tracking changes
    this.addHooks();
  }

  addHooks() {
    const tables = ['notebooks', 'notes', 'tags', 'menuItems', 'noteTags'] as const;
    
    tables.forEach(tableName => {
      this.table(tableName).hook('creating', (primKey, obj, transaction) => {
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
            // Since hooks can't be async in a way that blocks commit easily without strict transaction handling,
            // we might handle this by looking up the note.
            // However, Dexie hooks 'creating' expects return value or undefined.
            // We can add the event in the SAME transaction.
            // But we can't await inside the sync hook logic easily for a value required immediately?
            // Actually 'creating' hook allows returning a promise? No, usually it's synchronous for modification, 
            // but we can schedule a write to another table.
            // Let's use 'on("changes")' from dexie-observable if available? No, not installed.
            
            // Simplified: we will try to resolve notebookId. If we can't easily, we might miss noteTags syncing 
            // or we force sync for all notebooks? No, must be scoped.
            // Let's rely on the fact that if we are adding a tag to a note, we probably have the note loaded 
            // or we can fetch it.
            // Transaction object is available.
            transaction.table('notes').get((obj as NoteTag).noteId).then((note: Note) => {
                if (note) {
                    this.logSyncEvent(transaction, note.notebookId, tableName, entityId, 'create');
                }
            });
        }
      });

      this.table(tableName).hook('updating', (mods, primKey, obj, transaction) => {
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
             transaction.table('notes').get((obj as NoteTag).noteId).then((note: Note) => {
                if (note) {
                    this.logSyncEvent(transaction, note.notebookId, tableName, entityId, 'update');
                }
            });
        }
      });

      this.table(tableName).hook('deleting', (primKey, obj, transaction) => {
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
             transaction.table('notes').get((obj as NoteTag).noteId).then((note: Note) => {
                if (note) {
                    this.logSyncEvent(transaction, note.notebookId, tableName, entityId, 'delete');
                }
            });
        }
      });
    });
  }

  logSyncEvent(transaction: any, notebookId: string, entityName: string, entityId: string, action: 'create' | 'update' | 'delete') {
      // Add event to syncEvents table
      // We use a unique ID for the event
      const event: SyncEvent = {
          id: generateId(),
          notebookId,
          entityName,
          entityId,
          action,
          createdAt: Date.now()
      };
      // We must use the transaction to write
      transaction.table('syncEvents').add(event);
  }
}

export const db = new TimenoteDatabase();
