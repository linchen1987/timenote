export type FsMessage =
  | { type: 'fs:list'; path: string }
  | { type: 'fs:read'; path: string }
  | { type: 'fs:write'; path: string; content: string }
  | { type: 'fs:exists'; path: string }
  | { type: 'fs:ensureDir'; path: string }
  | { type: 'fs:stat'; path: string }
  | { type: 'sync:push'; notebookId: string }
  | { type: 'sync:pull'; notebookId: string }
  | { type: 'sync:getRemoteNotebooks' };

export type MessageResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };
