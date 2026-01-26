import { db, type Notebook, type Note, type Tag, type NoteTag, type MenuItem } from "../db";
import { WebDAVService } from "./webdav-service";
import { type BackupData } from "./backup-types";

const ROOT_PATH = "/timenote";

export class SyncService {

  static async init() {
     if (!(await WebDAVService.exists(ROOT_PATH))) {
         await WebDAVService.mkdir(ROOT_PATH);
     }
  }

  static async getRemoteNotebooks() {
    if (!(await WebDAVService.exists(ROOT_PATH))) return [];
    
    try {
        const list = await WebDAVService.list(ROOT_PATH);
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
                } catch (e) {
                    // console.warn(`Failed to read metadata for ${item.basename}`, e);
                }
                
                notebooks.push({
                    id,
                    name,
                    path: item.filename
                });
            }
        }
        return notebooks;
    } catch (e) {
        console.error("Failed to list remote notebooks", e);
        return [];
    }
  }

  static async syncNotebook(notebookId: string) {
      await this.init();
      const notebookPath = `${ROOT_PATH}/nb_${notebookId}`;
      if (!(await WebDAVService.exists(notebookPath))) {
          await WebDAVService.mkdir(notebookPath);
      }
      
      await this.pull(notebookId);
      await this.push(notebookId);
  }

  static async pull(notebookId: string) {
      const dataPath = `${ROOT_PATH}/nb_${notebookId}/data.json`;
      let remoteData: BackupData | null = null;
      try {
          const content = await WebDAVService.read(dataPath);
          remoteData = JSON.parse(content);
      } catch (e) {
          // console.log("No remote data found, skipping pull logic");
      }

      if (!remoteData) return;

      await db.transaction('rw', [db.notebooks, db.notes, db.tags, db.noteTags, db.menuItems, db.syncEvents], async () => {
          const events = await db.syncEvents.where('notebookId').equals(notebookId).toArray();
          
          const processEntity = async <T extends { id: string }>(
              tableName: 'notes' | 'tags' | 'menuItems' | 'notebooks',
              remoteList: T[] = [],
              localList: T[] = []
          ) => {
              const remoteMap = new Map(remoteList.map(i => [i.id, i]));
              const localMap = new Map(localList.map(i => [i.id, i]));
              
              // 1. Remote -> Local
              for (const rItem of remoteList) {
                  const lItem = localMap.get(rItem.id);
                  if (lItem) {
                      // Update check
                      if ('updatedAt' in rItem && 'updatedAt' in lItem) {
                          const rTime = (rItem as any).updatedAt || 0;
                          const lTime = (lItem as any).updatedAt || 0;
                          if (rTime > lTime) {
                              await db.table(tableName).put(rItem);
                          }
                      } else {
                          // For items without updatedAt (like Tags), assume Remote overwrites Local if different?
                          // Or simply Put to ensure consistency
                          await db.table(tableName).put(rItem);
                      }
                  } else {
                      // Check if deleted locally
                      const deleted = events.some(e => e.entityId === rItem.id && e.action === 'delete' && e.entityName === tableName);
                      if (!deleted) {
                          await db.table(tableName).add(rItem);
                      }
                  }
              }

              // 2. Local -> Check deletion
              for (const lItem of localList) {
                  if (!remoteMap.has(lItem.id)) {
                      // Check if created locally
                      const created = events.some(e => e.entityId === lItem.id && e.action === 'create' && e.entityName === tableName);
                      if (!created) {
                          // Deleted remotely
                          await db.table(tableName).delete(lItem.id);
                      }
                  }
              }
          };

          // 1. Notebooks
          const localNotebooks = await db.notebooks.where('id').equals(notebookId).toArray();
          await processEntity('notebooks', remoteData.notebooks, localNotebooks);

          // 2. Notes
          const localNotes = await db.notes.where('notebookId').equals(notebookId).toArray();
          await processEntity('notes', remoteData.notes, localNotes);
          
          // 3. Tags
          const localTags = await db.tags.where('notebookId').equals(notebookId).toArray();
          await processEntity('tags', remoteData.tags, localTags);

          // 4. MenuItems
          const localMenuItems = await db.menuItems.where('notebookId').equals(notebookId).toArray();
          await processEntity('menuItems', remoteData.menuItems, localMenuItems);

          // 5. NoteTags
          const rNoteTags = remoteData.noteTags || [];
          const localNoteIds = localNotes.map(n => n.id);
          const localNoteTags = await db.noteTags.where('noteId').anyOf(localNoteIds).toArray();
          
          const rNtSet = new Set(rNoteTags.map(nt => `${nt.noteId}:${nt.tagId}`));
          const lNtSet = new Set(localNoteTags.map(nt => `${nt.noteId}:${nt.tagId}`));
          
          // Remote -> Local
          for (const rNt of rNoteTags) {
              const key = `${rNt.noteId}:${rNt.tagId}`;
              if (!lNtSet.has(key)) {
                  const deleted = events.some(e => e.entityId === key && e.action === 'delete' && e.entityName === 'noteTags');
                  if (!deleted) {
                       await db.noteTags.put(rNt); // put supports composite key if defined
                  }
              }
          }
          
          // Local -> Remote
          for (const lNt of localNoteTags) {
              const key = `${lNt.noteId}:${lNt.tagId}`;
              if (!rNtSet.has(key)) {
                  const created = events.some(e => e.entityId === key && e.action === 'create' && e.entityName === 'noteTags');
                  if (!created) {
                      await db.noteTags.where({ noteId: lNt.noteId, tagId: lNt.tagId }).delete();
                  }
              }
          }
      });
  }
  
  static async push(notebookId: string) {
       const notebooks = await db.notebooks.where('id').equals(notebookId).toArray();
       if (notebooks.length === 0) return; 

       const notes = await db.notes.where('notebookId').equals(notebookId).toArray();
       const tags = await db.tags.where('notebookId').equals(notebookId).toArray();
       const menuItems = await db.menuItems.where('notebookId').equals(notebookId).toArray();
       
       const noteIds = notes.map(n => n.id);
       const noteTags = await db.noteTags.where('noteId').anyOf(noteIds).toArray();

       const data: BackupData = {
           version: 1,
           exportedAt: Date.now(),
           notebooks,
           notes,
           tags,
           noteTags,
           menuItems
       };
       
       const content = JSON.stringify(data, null, 2);
       const path = `${ROOT_PATH}/nb_${notebookId}/data.json`;
       
       await WebDAVService.write(path, content);
       
       await db.syncEvents.where('notebookId').equals(notebookId).delete();
  }
}
