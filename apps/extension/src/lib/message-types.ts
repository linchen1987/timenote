export type FsConnection =
  | { type: 'webdav'; url: string; username?: string; password?: string; token?: string }
  | {
      type: 's3';
      bucket: string;
      endpoint?: string;
      accessKeyId: string;
      secretAccessKey: string;
      region?: string;
    };

export type FsMessage =
  | { type: 'fs:list'; path: string; connection: FsConnection }
  | { type: 'fs:read'; path: string; connection: FsConnection }
  | { type: 'fs:write'; path: string; content: string; connection: FsConnection }
  | { type: 'fs:readBinary'; path: string; connection: FsConnection }
  | { type: 'fs:writeBinary'; path: string; content: string; connection: FsConnection }
  | { type: 'fs:delete'; path: string; connection: FsConnection }
  | { type: 'fs:exists'; path: string; connection: FsConnection }
  | { type: 'fs:ensureDir'; path: string; connection: FsConnection }
  | { type: 'fs:stat'; path: string; connection: FsConnection }
  | { type: 'sync:push'; notebookId: string }
  | { type: 'sync:pull'; notebookId: string }
  | { type: 'sync:getRemoteNotebooks' };

export type MessageResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };
