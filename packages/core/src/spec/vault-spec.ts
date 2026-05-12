/**
 * # Timenote Vault Specification
 *
 * 规范文档: docs/vault-spec.md
 */

// ─── Directory Structure ────────────────────────────────────

export const VAULT_TREE = `
/vault-root
  ├── .timenote/
  │   ├── manifest.json       ← core: vault 身份
  │   ├── menu.json           ← core: 侧边栏菜单
  │   ├── delete-log.json     ← core: 删除记录 (sync tombstone 来源)
  │   └── sync-ledger.json    ← non-core: 同步状态 (可从文件重建)
  ├── {YYYY-MM}/              ← Volume: ^[0-9]{4}-[0-9]{2}$
  │   └── {YYYYMMDD-HHmmss-SSSR}.md  ← Note: ^[0-9]{8}-[0-9]{6}-[0-9]{4}\\.[a-zA-Z0-9]+$
  └── assets/                 ← Attachments: SHA-256 hash-named files
      └── {hash[:2]}/
          └── {hash}.{ext}
` as const;

// ─── Meta File Registry ─────────────────────────────────────

export const VAULT_FILES = {
  manifest: { core: true, syncable: true, description: 'Vault identity and metadata' },
  menu: { core: true, syncable: true, description: 'Sidebar menu tree (nested, max 10000 nodes)' },
  deleteLog: {
    core: true,
    syncable: true,
    description: 'Deletion timestamps, source of sync tombstones',
  },
  syncLedger: {
    core: false,
    syncable: false,
    description: 'Sync state: content hashes + timestamps. Rebuildable from files',
  },
} as const;

// ─── Re-exports ─────────────────────────────────────────────

export { DELETE_LOG_EXAMPLE, type DeleteLog, DeleteLogSchema } from './delete-log';
export { IsoDateString, MANIFEST_EXAMPLE, type Manifest, ManifestSchema } from './manifest';
export {
  MENU_EXAMPLE,
  type MenuData,
  MenuDataSchema,
  type MenuItem,
  type RuntimeMenuItem,
  RuntimeMenuItemSchema,
} from './menu';
export {
  NOTE_EXAMPLE,
  NoteFilenameSchema,
  type NoteFrontmatter,
  NoteFrontmatterSchema,
  type NoteId,
  NoteIdSchema,
  normalizeAliases,
  normalizeTags,
  normalizeTitle,
  normalizeType,
  type ParsedNote,
  parseNote,
  parseNoteSafe,
  serializeNote,
  type VolumeName,
  VolumeNameSchema,
} from './note';
export {
  SYNC_LEDGER_EXAMPLE,
  type SyncEntity,
  SyncEntitySchema,
  type SyncLedger,
  SyncLedgerSchema,
} from './sync-ledger';
export {
  META_DIR,
  META_FILES,
  type MetaFileName,
  metaPath,
  SYNCABLE_META_FILES,
  syncLedgerPath,
} from './vault-layout';
