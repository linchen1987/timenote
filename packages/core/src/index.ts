// ─── General Utilities ────────────────────────────────────────

export { CONTACT_EMAIL, NOTE_LIST_PAGE_SIZE, STORAGE_KEYS } from './constants';
export { useLocalStorage } from './hooks/use-local-storage';
export type { UseStorage } from './hooks/use-storage';
export { cn } from './utils/cn';
export {
  createNotebookToken,
  decodeBase58,
  encodeBase58,
  parseNotebookId,
  parseNotebookName,
} from './utils/token';

// ─── Provider Layer ──────────────────────────────────────────

export {
  createIndexService,
  deleteVaultIndexDatabase,
  type IndexService,
  type NoteIndex,
  NoteIndexSchema,
} from './provider/index-service';
export { createOpfsTransport, type OpfsTransport } from './provider/opfs-transport';
export {
  type SearchProvider,
  type SearchResult,
  SimpleSearchProvider,
} from './provider/search-provider';

// ─── Sync Engine + Vault Lifecycle ────────────────────────────

export {
  applyDirtyEntries,
  buildEmptyLedger,
  buildLedgerFromFile,
  buildLedgerFromFs,
  type DirtyEntry,
} from './vault/build-ledger';
export { type ExecuteResult, executePlan } from './vault/execute-plan';
export {
  createVaultExportService,
  type VaultExportService,
} from './vault/export-service';
export {
  createVaultImportService,
  type ImportResult,
  type VaultImportService,
} from './vault/import-service';
export {
  compareEntities,
  mergeEntities,
  resolve,
  type SyncDirection,
  type SyncPlan,
  type SyncSession,
} from './vault/sync-algorithm';
export {
  createPrefixedTransport,
  createVaultSyncService,
  type RemoteTransport,
  type SyncOptions,
  type SyncResult,
  type SyncStatus,
  toVaultFs,
  type VaultSyncService,
} from './vault/sync-service';
export {
  createOpfsVaultFs,
  createTransportVaultFs,
  type VaultFs,
} from './vault/vault-fs';
export {
  createVaultService,
  type VaultMeta,
  type VaultService,
  type VaultTransport,
} from './vault/vault-service';
export { writeLedger } from './vault/write-ledger';

// ─── Service Layer ───────────────────────────────────────────

export { createVaultMenuService, type VaultMenuService } from './service/menu-service';
export {
  flattenMenuItems,
  nestifyMenuItems,
  updateMenuNoteId,
} from './service/menu-transform';
export {
  createVaultNoteService,
  type VaultNoteService,
} from './service/note-service';
export { extractTagsFromBody, type ParsedSearchQuery } from './service/search-query';
export { createVaultStore, type VaultStore } from './service/vault-store';

// ─── Migration (v1.x → v2.0) ────────────────────────────────

export {
  createMigrationService,
  type LegacyNotebookInfo,
  type MigrationProgress,
  type MigrationResult,
  type MigrationService,
} from './migration/migration-service';

// ─── Spec Layer (Persistence Format) ──────────────────────────

export { DELETE_LOG_EXAMPLE, type DeleteLog, DeleteLogSchema } from './spec/delete-log';
export { computeContentHash } from './spec/hash';
export {
  IsoDateString,
  MANIFEST_EXAMPLE,
  type Manifest,
  ManifestSchema,
} from './spec/manifest';
export {
  MENU_EXAMPLE,
  type MenuData,
  MenuDataSchema,
  type MenuItem,
  type RuntimeMenuItem,
  RuntimeMenuItemSchema,
} from './spec/menu';
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
} from './spec/note';
export {
  filenameFromNoteId,
  generateNoteId,
  isNoteIdUrl,
  isValidNoteFilename,
  isValidNoteId,
  isValidVolumeName,
  noteIdFromFilename,
  noteIdFromUrl,
  noteIdToUrl,
  notePath,
  volumeNameFromDate,
  volumeNameFromNoteId,
} from './spec/note-id';
export { generateProjectId } from './spec/project-id';
export {
  SYNC_LEDGER_EXAMPLE,
  type SyncEntity,
  SyncEntitySchema,
  type SyncLedger,
  SyncLedgerSchema,
} from './spec/sync-ledger';
export {
  classifyEntry,
  isNoteFile,
  isNoteFileEntry,
  isVolume,
  isVolumeEntry,
  MAX_ZIP_SIZE,
  META_DIR,
  META_FILES,
  metaPath,
  noteFilePath,
  SYNCABLE_META_FILES,
  syncLedgerPath,
} from './spec/vault-layout';
export { VAULT_FILES, VAULT_TREE } from './spec/vault-spec';
