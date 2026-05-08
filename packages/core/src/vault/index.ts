// ─── Provider Layer ──────────────────────────────────────────

export {
  createIndexService,
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

// ─── Service Layer ───────────────────────────────────────────

export {
  createVaultExportService,
  type VaultExportService,
} from './service/export-service';
export {
  createVaultImportService,
  type ImportResult,
  type VaultImportService,
} from './service/import-service';
export { createVaultMenuService, type VaultMenuService } from './service/menu-service';
export {
  flattenMenuItems,
  nestifyMenuItems,
  updateMenuNoteId,
} from './service/menu-transform';
export {
  createMigrationService,
  type LegacyNotebookInfo,
  type MigrationProgress,
  type MigrationResult,
  type MigrationService,
} from './service/migration-service';
export {
  createVaultNoteService,
  type VaultNoteService,
} from './service/note-service';
export { extractTagsFromBody, type ParsedSearchQuery } from './service/search-query';
export { compareEntities, mergeEntities, type SyncPlan } from './service/sync-algorithm';
export {
  createPrefixedTransport,
  createVaultSyncService,
  type RemoteTransport,
  type SyncResult,
  type SyncStatus,
  type VaultSyncService,
} from './service/sync-service';
export {
  createVaultService,
  type VaultMeta,
  type VaultService,
  type VaultTransport,
} from './service/vault-service';

// ─── Spec Layer (Persistence Format) ─────────────────────────

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
