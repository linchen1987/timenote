import { createSyncService } from '@timenote/core';
import { FsService } from './fs-service';

export const SyncService = createSyncService(FsService);
