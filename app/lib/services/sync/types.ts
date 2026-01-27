import type { MenuItem, Note, Notebook, NoteTag, Tag } from '~/lib/types';

export type SyncableEntity = Notebook | Note | Tag | MenuItem | NoteTag;

export const SYNC_ROOT_PATH = '/timenote';

export interface BackupData {
  notebooks?: Notebook[];
  notes?: Note[];
  tags?: Tag[];
  noteTags?: NoteTag[];
  menuItems?: MenuItem[];
  version: number;
  exportedAt: number;
}

export interface DataApplyResult {
  success: number;
  skipped: number;
  errors: string[];
}
