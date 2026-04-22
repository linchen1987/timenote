import { createSyncStore, type ToastAdapter } from '@timenote/core';
import { toast } from 'sonner';
import { FsService } from './fs-service';
import { SyncService } from './sync-service';

const sonnerToast: ToastAdapter = {
  success: (message) => toast.success(message),
  error: (message) => toast.error(message),
};

export const useSyncStore = createSyncStore(FsService, SyncService, sonnerToast);
