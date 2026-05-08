/**
 * # Timenote Vault Specification
 *
 * ## Design Philosophy
 * - 个人笔记应用，极简主义与性能平衡
 * - 兼容文件系统
 * - 人类可读优先
 * - 万物皆 markdown，不直接处理图片/附件
 * - 白名单准入：引擎仅识别符合规范的文件和路径，其余文件视为透明
 *
 * ## Core vs Non-Core
 * - Core (物理文件即真理 Single Source of Truth): .md 笔记、manifest.json、menu.json、delete-log.json
 * - Non-Core (可从核心数据重建): sync-ledger.json、IndexedDB 索引
 *
 * ## File → Module Map
 * - manifest.json    → spec/manifest.ts
 * - menu.json        → spec/menu.ts
 * - delete-log.json  → spec/delete-log.ts
 * - sync-ledger.json → spec/sync-ledger.ts
 * - .md note file    → spec/note.ts
 *
 * ## Spec Utilities (in spec/)
 * - note-id.ts       → Note ID generation & validation
 * - project-id.ts    → Project ID generation
 * - hash.ts          → Content hash (MD5)
 * - vault-layout.ts  → Directory structure, path conventions, file classification
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
  └── ...
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
