export interface FsTransport {
  list(path: string): Promise<FsStat[]>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
  isConfigured(): boolean;
}

export type FsStat = {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: 'file' | 'directory';
  mime?: string;
  etag?: string | null;
};
