import { createSyncService } from '@timenote/core';
import { FsService as webFsService } from '../lib/fs-service';

export const SyncService = createSyncService(webFsService);
