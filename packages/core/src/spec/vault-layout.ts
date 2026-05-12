import { isValidNoteFilename, isValidVolumeName } from './note-id';

export const META_DIR = '.timenote';

export const META_FILES = {
  manifest: 'manifest.json',
  menu: 'menu.json',
  deleteLog: 'delete-log.json',
  syncLedger: 'sync-ledger.json',
} as const;

export type MetaFileName = keyof typeof META_FILES;

export const SYNCABLE_META_FILES: readonly string[] = [
  META_FILES.manifest,
  META_FILES.menu,
  META_FILES.deleteLog,
];

export const ASSETS_DIR = 'assets';

export const VOLUME_PATTERN = /^[0-9]{4}-[0-9]{2}$/;

export const NOTE_FILE_PATTERN = /^[0-9]{8}-[0-9]{6}-[0-9]{4}\.[a-zA-Z0-9]+$/;

export const MAX_ZIP_SIZE = 100 * 1024 * 1024;

export function metaPath(name: MetaFileName): string {
  return `${META_DIR}/${META_FILES[name]}`;
}

export function syncLedgerPath(): string {
  return metaPath('syncLedger');
}

export function noteFilePath(noteId: string, ext = 'md'): string {
  const yyyy = noteId.slice(0, 4);
  const mm = noteId.slice(4, 6);
  const vol = `${yyyy}-${mm}`;
  return `${vol}/${noteId}.${ext}`;
}

export function assetPath(hash: string, ext: string): string {
  const shard = hash.slice(0, 2);
  return `${ASSETS_DIR}/${shard}/${hash}.${ext}`;
}

export function isAssetPath(path: string): boolean {
  return path === ASSETS_DIR || path.startsWith(`${ASSETS_DIR}/`);
}

export function isVolume(name: string): boolean {
  return VOLUME_PATTERN.test(name);
}

export function isNoteFile(filename: string): boolean {
  return NOTE_FILE_PATTERN.test(filename);
}

export function isVolumeEntry(entry: { type: string; basename: string }): boolean {
  return entry.type === 'directory' && isVolume(entry.basename);
}

export function isNoteFileEntry(entry: { type: string; basename: string }): boolean {
  return entry.type === 'file' && isNoteFile(entry.basename);
}

export type EntryClass =
  | 'meta'
  | 'manifest'
  | 'note'
  | 'attachment'
  | 'syncLedger'
  | 'unrecognized';

export function classifyEntry(path: string): EntryClass {
  if (path === metaPath('manifest')) return 'manifest';
  if (path === metaPath('syncLedger')) return 'syncLedger';
  if (path.startsWith(`${META_DIR}/`)) return 'meta';

  if (path === ASSETS_DIR || path.startsWith(`${ASSETS_DIR}/`)) return 'attachment';

  const parts = path.split('/');
  if (parts.length === 2 && isValidVolumeName(parts[0]) && isValidNoteFilename(parts[1])) {
    return 'note';
  }

  return 'unrecognized';
}
