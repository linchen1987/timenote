import type { BackupData, DataApplyResult } from '~/lib/services/sync/types';
import { DataService } from './data-service';

export const ImportService = {
  async importData(data: BackupData): Promise<DataApplyResult> {
    return DataService.applyBackupData(data);
  },
};
