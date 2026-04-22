import { DataService } from './data-service';
import type { BackupData, DataApplyResult } from './sync/types';

export const ImportService = {
  async importData(data: BackupData): Promise<DataApplyResult> {
    return DataService.applyBackupData(data);
  },
};
