import type { ProviderConfig } from '@timenote/core';

export type { ProviderConfig as FsConfig };

type BaseMessage = { config: ProviderConfig; path: string };

export type FsMessage =
  | (BaseMessage & { type: 'fs:list' })
  | (BaseMessage & { type: 'fs:read' })
  | (BaseMessage & { type: 'fs:write'; content: string })
  | (BaseMessage & { type: 'fs:readBinary' })
  | (BaseMessage & { type: 'fs:writeBinary'; content: string })
  | (BaseMessage & { type: 'fs:delete' })
  | (BaseMessage & { type: 'fs:exists' })
  | (BaseMessage & { type: 'fs:ensureDir' })
  | (BaseMessage & { type: 'fs:stat' });

export type MessageResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };
