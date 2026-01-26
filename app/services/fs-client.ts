import { createClient, type WebDAVClient, type WebDAVClientOptions, type FileStat } from "webdav";

export type FsConnection = 
  | { type: "webdav"; url: string; username?: string; password?: string; token?: string }
  | { type: "s3"; bucket: string; endpoint?: string; accessKeyId: string; secretAccessKey: string; region?: string };

export type FsStat = {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: "file" | "directory";
  mime?: string;
  etag?: string | null;
};

export interface FsClient {
  readdir(path: string): Promise<FsStat[]>;
  readFile(path: string): Promise<ArrayBuffer>;
  writeFile(path: string, content: string | ArrayBuffer): Promise<void>;
  unlink(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  copy(source: string, destination: string): Promise<void>;
  stat(path: string): Promise<FsStat>;
}

export function createFsClient(connection: FsConnection): FsClient {
  if (connection.type === "webdav") {
    return new WebDavFsClient(connection);
  }
  throw new Error(`Unsupported connection type: ${(connection as any).type}`);
}

class WebDavFsClient implements FsClient {
  private client: WebDAVClient;

  constructor(config: { url: string; username?: string; password?: string; token?: string }) {
    const options: WebDAVClientOptions = {
        // Explicitly pass the global fetch to ensure it uses the Cloudflare Workers fetch implementation
        // This is crucial for environments like CF Workers where native http/https modules are not available/polyfilled perfectly
        // @ts-ignore
        fetch: globalThis.fetch,
        headers: {
            // Mimic native Windows WebDAV client
            "User-Agent": "Microsoft-WebDAV-MiniRedir/10.0.19043", 
            "Accept": "*/*",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
        }
    };

    if (config.username) options.username = config.username;
    if (config.password) options.password = config.password;
    if (config.token) options.token = { access_token: config.token, token_type: "Bearer" };
    
    this.client = createClient(config.url, options);
  }

  async readdir(path: string): Promise<FsStat[]> {
    try {
      const result = await this.client.getDirectoryContents(path) as FileStat[] | FileStat;
      const items: FileStat[] = Array.isArray(result) ? result : [result];
      
      return items.map(item => ({
        filename: item.filename,
        basename: item.basename,
        lastmod: item.lastmod,
        size: item.size,
        type: item.type === "directory" ? "directory" : "file",
        mime: item.mime,
        etag: item.etag
      }));
    } catch (e: any) {
       console.error("WebDAV readdir error:", e);
       throw e;
    }
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    const result = await this.client.getFileContents(path, { format: "binary" });
    return result as ArrayBuffer;
  }

  async writeFile(path: string, content: string | ArrayBuffer): Promise<void> {
    await this.client.putFileContents(path, content);
  }

  async unlink(path: string): Promise<void> {
    await this.client.deleteFile(path);
  }

  async mkdir(path: string): Promise<void> {
    await this.client.createDirectory(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.client.moveFile(oldPath, newPath);
  }

  async copy(source: string, destination: string): Promise<void> {
    await this.client.copyFile(source, destination);
  }

  async stat(path: string): Promise<FsStat> {
    const item = await this.client.stat(path) as FileStat;
    return {
      filename: item.filename,
      basename: item.basename,
      lastmod: item.lastmod,
      size: item.size,
      type: item.type === "directory" ? "directory" : "file",
      mime: item.mime,
      etag: item.etag
    };
  }
}
