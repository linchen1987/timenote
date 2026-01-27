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
  notebookId: string;
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
