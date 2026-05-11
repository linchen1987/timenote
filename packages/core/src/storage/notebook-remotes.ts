import { STORAGE_KEYS } from '../constants';

export interface RemoteEntry {
  providerId: string;
  path: string;
  enabled: boolean;
}

export type NotebookRemoteConfig = Record<string, Record<string, RemoteEntry>>;

const DEFAULT_REMOTE_NAME = 'origin';

function readConfig(): NotebookRemoteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTEBOOK_REMOTES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeConfig(config: NotebookRemoteConfig): void {
  localStorage.setItem(STORAGE_KEYS.NOTEBOOK_REMOTES, JSON.stringify(config));
}

export function getRemote(projectId: string, remoteName?: string): RemoteEntry | null {
  const config = readConfig();
  const name = remoteName ?? DEFAULT_REMOTE_NAME;
  return config[projectId]?.[name] ?? null;
}

export function getAllRemotes(projectId: string): Record<string, RemoteEntry> {
  return readConfig()[projectId] ?? {};
}

export function setRemote(projectId: string, remoteName: string, entry: RemoteEntry): void {
  const config = readConfig();
  if (!config[projectId]) config[projectId] = {};
  config[projectId][remoteName] = entry;
  writeConfig(config);
}

export function removeRemote(projectId: string, remoteName?: string): void {
  const config = readConfig();
  const name = remoteName ?? DEFAULT_REMOTE_NAME;
  if (config[projectId]) {
    delete config[projectId][name];
    if (Object.keys(config[projectId]).length === 0) {
      delete config[projectId];
    }
  }
  writeConfig(config);
}

export function listAllRemotes(): NotebookRemoteConfig {
  return readConfig();
}

export function getEnabledRemotes(projectId: string): Record<string, RemoteEntry> {
  const remotes = getAllRemotes(projectId);
  const enabled: Record<string, RemoteEntry> = {};
  for (const [name, entry] of Object.entries(remotes)) {
    if (entry.enabled) enabled[name] = entry;
  }
  return enabled;
}

export function getDefaultRemotePath(projectId: string): string {
  return `timenote/vaults/${projectId}`;
}
