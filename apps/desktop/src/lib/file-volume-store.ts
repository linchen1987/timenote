import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import {
  createFileVolumeStore as createCoreFileVolumeStore,
  type FileVolumeStoreIo,
  type FsVolumeCredentialStore,
} from '@timenote/core';

const VOLUMES_FILENAME = 'volumes.json';

let _volumesPath: string | null = null;

async function resolveVolumesPath(): Promise<string> {
  if (!_volumesPath) {
    const dir = await invoke<string>('config_dir');
    _volumesPath = await join(dir, VOLUMES_FILENAME);
  }
  return _volumesPath;
}

function createTauriVolumeIo(): FileVolumeStoreIo {
  return {
    async readFile(p: string): Promise<string | null> {
      const exists = await invoke<boolean>('fs_exists', { path: p });
      if (!exists) return null;
      try {
        return await invoke<string>('fs_read_text_file', { path: p });
      } catch {
        return null;
      }
    },
    async writeFile(p: string, content: string): Promise<void> {
      await invoke<void>('fs_write_text_file', { path: p, content });
    },
    async rename(from: string, to: string): Promise<void> {
      await invoke<void>('fs_rename', { from, to });
    },
    async exists(p: string): Promise<boolean> {
      return invoke<boolean>('fs_exists', { path: p });
    },
  };
}

/**
 * Load the shared file-backed volume store (~/.config/timenote/volumes.json).
 */
export async function loadVolumeStore(): Promise<
  FsVolumeCredentialStore & { reload(): Promise<void> }
> {
  const io = createTauriVolumeIo();
  const volumesPath = await resolveVolumesPath();
  const store = createCoreFileVolumeStore(io, volumesPath);
  await store.reload();
  return store;
}
