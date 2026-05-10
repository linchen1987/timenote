import { DeleteLogSchema } from '../spec/delete-log';
import { computeContentHash } from '../spec/hash';
import { type NoteId, parseNoteSafe } from '../spec/note';
import { isValidNoteFilename, isValidVolumeName, volumeNameFromNoteId } from '../spec/note-id';
import {
  createEmptySyncLedger,
  createSyncLedger,
  type SyncEntity,
  type SyncLedger,
  SyncLedgerSchema,
} from '../spec/sync-ledger';
import { META_DIR, metaPath, SYNCABLE_META_FILES, syncLedgerPath } from '../spec/vault-layout';
import type { VaultFs } from './vault-fs';

export type DirtyEntry =
  | { type: 'note'; path: string; action: 'upsert' }
  | { type: 'note'; path: string; action: 'delete' }
  | { type: 'meta'; key: string; action: 'upsert' };

export async function buildLedgerFromFs(fs: VaultFs): Promise<SyncLedger> {
  const entities: Record<string, SyncEntity> = {};
  const metaFiles: Record<string, SyncEntity> = {};

  const volumes = await fs.list('');
  for (const vol of volumes) {
    if (vol.type !== 'directory' || !isValidVolumeName(vol.basename)) continue;
    const items = await fs.list(vol.basename);
    for (const item of items) {
      if (item.type === 'file' && isValidNoteFilename(item.basename)) {
        const path = `${vol.basename}/${item.basename}`;
        try {
          const content = await fs.read(path);
          const parsed = parseNoteSafe(content);
          const updatedAt = parsed?.frontmatter.updated_at || new Date().toISOString();
          entities[path] = { h: await computeContentHash(content), u: updatedAt };
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  for (const mf of SYNCABLE_META_FILES) {
    try {
      const content = await fs.read(`${META_DIR}/${mf}`);
      const parsed = JSON.parse(content);
      const updatedAt = parsed.updated_at || new Date().toISOString();
      metaFiles[mf] = { h: await computeContentHash(content), u: updatedAt };
    } catch {
      // skip missing meta files
    }
  }

  try {
    const raw = await fs.read(metaPath('deleteLog'));
    const log = DeleteLogSchema.parse(JSON.parse(raw));
    for (const [noteId, deletedAt] of Object.entries(log.records)) {
      const vol = volumeNameFromNoteId(noteId as NoteId);
      const path = `${vol}/${noteId}.md`;
      if (!entities[path]) {
        entities[path] = { d: true, u: deletedAt };
      }
    }
  } catch {
    // skip invalid or missing delete-log
  }

  return createSyncLedger(entities, metaFiles);
}

export async function applyDirtyEntries(
  fs: VaultFs,
  base: SyncLedger,
  dirty: DirtyEntry[],
): Promise<SyncLedger> {
  const entities = { ...base.entities };
  const metaFiles = { ...base.meta_files };

  let deleteLog: Record<string, string> | null = null;

  for (const entry of dirty) {
    if (entry.type === 'meta') {
      try {
        const content = await fs.read(`${META_DIR}/${entry.key}`);
        const parsed = JSON.parse(content);
        const updatedAt = parsed.updated_at || new Date().toISOString();
        metaFiles[entry.key] = {
          h: await computeContentHash(content),
          u: updatedAt,
        };
      } catch {
        delete metaFiles[entry.key];
      }
    } else if (entry.action === 'upsert') {
      try {
        const content = await fs.read(entry.path);
        const parsed = parseNoteSafe(content);
        const updatedAt = parsed?.frontmatter.updated_at || new Date().toISOString();
        entities[entry.path] = { h: await computeContentHash(content), u: updatedAt };
      } catch {
        // skip if file can't be read
      }
    } else {
      if (!deleteLog) {
        try {
          const raw = await fs.read(metaPath('deleteLog'));
          deleteLog = DeleteLogSchema.parse(JSON.parse(raw)).records;
        } catch {
          deleteLog = {};
        }
      }
      const filename = entry.path.split('/').pop() || '';
      const noteId = filename.replace(/\.md$/, '');
      const deletedAt = deleteLog[noteId];
      if (deletedAt) {
        entities[entry.path] = { d: true, u: deletedAt };
      } else {
        delete entities[entry.path];
      }
    }
  }

  return createSyncLedger(entities, metaFiles);
}

export async function buildLedgerFromFile(fs: VaultFs): Promise<SyncLedger> {
  const content = await fs.read(syncLedgerPath());
  return SyncLedgerSchema.parse(JSON.parse(content));
}

export function buildEmptyLedger(): SyncLedger {
  return createEmptySyncLedger();
}
