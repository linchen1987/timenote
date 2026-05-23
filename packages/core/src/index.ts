// ─── General Utilities ────────────────────────────────────────

export { CONTACT_EMAIL, NOTE_LIST_PAGE_SIZE, STORAGE_KEYS } from './constants';
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
  createFsClient,
  type FsClient,
  type FsConnection,
  type FsStat,
} from './provider/fs-client';
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

// ─── Storage Configuration ──────────────────────────────────────

export {
  getAllRemotes,
  getDefaultRemotePath,
  getEnabledRemotes,
  getRemote,
  listAllRemotes,
  type NotebookRemoteConfig,
  type RemoteEntry,
  removeRemote,
  setRemote,
} from './storage/notebook-remotes';
export { migrateLegacyProviders } from './storage/provider-migration';
export {
  deleteProvider,
  generateProviderId,
  getProvider,
  listProviders,
  type ProviderConfig,
  type ProviderType,
  type S3Provider,
  saveProvider,
  type WebdavProvider,
} from './storage/provider-registry';

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

export {
  type AttachmentService,
  type AttachmentWriteResult,
  computeAssetPath,
  createAttachmentService,
  extFromFilename,
  inferMimeFromExt,
  inferMimeFromPath,
} from './service/attachment-service';
export { createVaultMenuService, type VaultMenuService } from './service/menu-service';
export {
  flattenMenuItems,
  nestifyMenuItems,
  updateMenuNoteId,
} from './service/menu-transform';
export { createNoteOp, deleteNoteOp, updateNoteOp } from './service/note-ops';
export {
  createVaultNoteService,
  type EditAttachment,
  type PendingAttachment,
  type SaveNoteOptions,
  type StagedAttachment,
  type VaultNoteService,
} from './service/note-service';
export { extractTagsFromBody, type ParsedSearchQuery } from './service/search-query';
export { createVaultStore, type TransportResolver, type VaultStore } from './service/vault-store';

// ─── Spec Layer (Persistence Format) ──────────────────────────

export {
  createEmptyDeleteLog,
  DELETE_LOG_EXAMPLE,
  type DeleteLog,
  DeleteLogSchema,
} from './spec/delete-log';
export { computeBinaryHash, computeContentHash } from './spec/hash';
export {
  createManifest,
  IsoDateString,
  MANIFEST_EXAMPLE,
  type Manifest,
  ManifestSchema,
} from './spec/manifest';
export {
  createMenuData,
  MENU_EXAMPLE,
  type MenuData,
  MenuDataSchema,
  type MenuItem,
  type RuntimeMenuItem,
  RuntimeMenuItemSchema,
} from './spec/menu';
export {
  type AttachmentRef,
  AttachmentRefSchema,
  NOTE_EXAMPLE,
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
  createEmptySyncLedger,
  SYNC_LEDGER_EXAMPLE,
  type SyncEntity,
  SyncEntitySchema,
  type SyncLedger,
  SyncLedgerSchema,
} from './spec/sync-ledger';
export {
  ASSETS_DIR,
  assetPath,
  classifyEntry,
  isAssetPath,
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
