import { type Notebook, type Note, type Tag, type NoteTag, type MenuItem } from '../db';

export interface BackupData {
  notebooks?: Notebook[];
  notes?: Note[];
  tags?: Tag[];
  noteTags?: NoteTag[];
  menuItems?: MenuItem[];
  version: number;
  exportedAt: number;
}

export interface ImportStats {
  success: number;
  skipped: number;
  errors: string[];
}
