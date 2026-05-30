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

// ─── FS Transport ────────────────────────────────────────────

export type { FsStat, FsTransport } from './fs/transport';
export { createPrefixedTransport } from './fs/prefixed';
export { createOpfsTransport, type OpfsTransport } from './fs/opfs';
export { createS3Transport } from './fs/s3';
export { createWebdavTransport } from './fs/webdav';
// NodeFS transport not exported from barrel (node:fs breaks browser builds)
// CLI imports directly: import { createNodeFsTransport } from '@timenote/core/fs/node-fs'

// ─── Storage Provider Config ─────────────────────────────────

export {
  type TransportParams,
  type WebdavTransportParams,
  type S3TransportParams,
  type WebdavIdentity,
  type WebdavConfig,
  type S3Identity,
  type S3Config,
  type StorageProviderConfig,
  type StorageProviderIdentity,
  type StorageProviderType,
  type ProviderDef,
  PROVIDER_DEFS,
  generateProviderId,
  parseSourceUrl,
  stringifySourceUrl,
  serializeTransportParams,
  createTransportFromConfig,
  createTransportFromParams,
} from './fs/config/providers';
export {
  configToConnection,
  testConnection,
} from './fs/config/connection';
export {
  createLocalStorageProviderStore,
  deleteProvider,
  getProvider,
  listProviders,
  type StorageProviderEntry,
  type StorageProviderStore,
  saveProvider,
} from './fs/config/store';

// Backward-compatible aliases
export { configToConnection as connectionFromProvider } from './fs/config/connection';
export { createTransportFromConfig as createTransportFromProvider } from './fs/config/providers';
export { testConnection as testProviderConnection } from './fs/config/connection';
export { generateProviderId as generateStorageProviderId } from './fs/config/providers';
export { parseSourceUrl as parseRemoteUrl } from './fs/config/providers';
export { stringifySourceUrl as stringifyRemoteUrl } from './fs/config/providers';
export { serializeTransportParams as connectionFromConfig } from './fs/config/providers';
export { createTransportFromParams as createTransportFromConnection } from './fs/config/providers';
export type { TransportParams as FsConnection } from './fs/config/providers';
export type { StorageProviderConfig as ProviderConfig } from './fs/config/providers';
export type { StorageProviderIdentity as ProviderIdentity } from './fs/config/providers';
export type { StorageProviderType as ProviderType } from './fs/config/providers';
export type { StorageProviderEntry as ProviderEntry } from './fs/config/store';
export type { StorageProviderStore as ProviderStore } from './fs/config/store';

// ─── Remote Bindings ─────────────────────────────────────────

export {
  type ConfigLocal,
  ConfigLocalSchema,
  createEmptyConfigLocal,
  type RemoteConfig,
  RemoteConfigSchema,
} from './spec/config-local';
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
  updateProviderIdReferences,
} from './vault/notebook-remotes';

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
  detectZipRootPrefix,
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
  createVaultSyncService,
  type SyncOptions,
  type SyncResult,
  type SyncStatus,
  type VaultSyncService,
} from './vault/sync-service';
export {
  appendDeleteLog,
  initVault,
} from './vault/vault-ops';
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
export {
  createIndexService,
  deleteVaultIndexDatabase,
  type IndexService,
  type NoteIndex,
  NoteIndexSchema,
} from './service/index-service';
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
export {
  type SearchProvider,
  type SearchResult,
  SimpleSearchProvider,
} from './service/search-provider';
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
