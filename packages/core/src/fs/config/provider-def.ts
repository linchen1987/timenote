import type { FsTransport } from '../transport';

export interface ProviderDef<
  I extends { type: string } = { type: string },
  C extends { type: string } = { type: string },
> {
  scheme: string;
  generateId: (identity: I) => string;
  parseSource: (userinfo: string, host: string, path: string) => I & { path: string };
  createTransport: (config: C) => FsTransport;
}
