import { DataService } from './data-service';
import type { BackupData } from './sync/types';

export const ExportService = {
  async exportData(onDownload?: (blob: Blob, filename: string) => void): Promise<BackupData> {
    const data = await DataService.fetchBackupData();

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const filename = `timenote-export-${new Date().toISOString().split('T')[0]}.json`;

    if (onDownload) {
      onDownload(blob, filename);
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    return data;
  },
};
