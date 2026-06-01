import type { FsClient } from '../fs/client';
import {
  type ConfigLocal,
  ConfigLocalSchema,
  createEmptyConfigLocal,
  type RemoteConfig,
} from '../spec/config-local';
import { META_DIR } from '../spec/vault-layout';

const CONFIG_LOCAL_FILENAME = 'config.local.json';

function configLocalPath(): string {
  return `${META_DIR}/${CONFIG_LOCAL_FILENAME}`;
}

export interface RemoteConfigService {
  listRemotes(): Promise<RemoteConfig[]>;
  getRemote(name: string): Promise<RemoteConfig | null>;
  getDefaultRemote(): Promise<RemoteConfig | null>;
  setRemote(entry: RemoteConfig): Promise<void>;
  removeRemote(name: string): Promise<void>;
  setDefault(name: string): Promise<void>;
}

async function readConfig(transport: FsClient): Promise<ConfigLocal> {
  try {
    const raw = await transport.read(configLocalPath());
    return ConfigLocalSchema.parse(JSON.parse(raw));
  } catch {
    return createEmptyConfigLocal();
  }
}

async function writeConfig(transport: FsClient, config: ConfigLocal): Promise<void> {
  await transport.ensureDir(META_DIR);
  await transport.write(configLocalPath(), JSON.stringify(config, null, 2));
}

export function createRemoteConfigService(
  getTransport: () => Promise<FsClient> | FsClient,
): RemoteConfigService {
  async function getTransportAsync(): Promise<FsClient> {
    return await getTransport();
  }

  return {
    async listRemotes(): Promise<RemoteConfig[]> {
      const transport = await getTransportAsync();
      const config = await readConfig(transport);
      return config.remotes;
    },

    async getRemote(name: string): Promise<RemoteConfig | null> {
      const transport = await getTransportAsync();
      const config = await readConfig(transport);
      return config.remotes.find((r) => r.name === name) ?? null;
    },

    async getDefaultRemote(): Promise<RemoteConfig | null> {
      const transport = await getTransportAsync();
      const config = await readConfig(transport);
      return config.remotes.find((r) => r.default === true) ?? config.remotes[0] ?? null;
    },

    async setRemote(entry: RemoteConfig): Promise<void> {
      const transport = await getTransportAsync();
      const config = await readConfig(transport);
      const idx = config.remotes.findIndex((r) => r.name === entry.name);
      if (idx >= 0) {
        config.remotes[idx] = entry;
      } else {
        config.remotes.push(entry);
      }
      await writeConfig(transport, config);
    },

    async removeRemote(name: string): Promise<void> {
      const transport = await getTransportAsync();
      const config = await readConfig(transport);
      config.remotes = config.remotes.filter((r) => r.name !== name);
      await writeConfig(transport, config);
    },

    async setDefault(name: string): Promise<void> {
      const transport = await getTransportAsync();
      const config = await readConfig(transport);
      for (const r of config.remotes) {
        r.default = r.name === name ? true : undefined;
      }
      await writeConfig(transport, config);
    },
  };
}
