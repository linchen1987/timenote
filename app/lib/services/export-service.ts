import { db } from '../db';
import { type BackupData } from './backup-types';

export const ExportService = {
  async exportData(): Promise<BackupData> {
    const notebooks = await db.notebooks.toArray();
    const notes = await db.notes.toArray();
    const tags = await db.tags.toArray();
    const noteTags = await db.noteTags.toArray();
    const menuItems = await db.menuItems.toArray();

    const data: BackupData = {
      notebooks,
      notes,
      tags,
      noteTags,
      menuItems,
      version: 5,
      exportedAt: Date.now()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timenote-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return data;
  }
};
