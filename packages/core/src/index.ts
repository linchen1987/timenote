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

export type { FsProvider, FsProviderStat } from './fs/provider';
export type { VaultRegistry, VaultRegistryEntry } from './vault/vault-registry';
export { createOpfsVaultRegistry } from './vault/vault-registry-opfs';

// NodeFS transport not exported from barrel (node:fs breaks browser builds)
// CLI imports directly: import { createNodeFsProvider } from '@timenote/core/fs/providers/fs/node'

// ─── FsProvider Config ────────────────────────────────────────

export {
  buildSourceUrl,
  configToUrl,
  createFsProvider,
  createFsProviderFromUrl,
  createOpfsProvider,
  createProviderFromConfig,
  createS3Provider,
  createWebdavProvider,
  type FsAccount,
  type FsConfig,
  type FsEndpoint,
  type FsIdentity,
  type FsProviderAccount,
  type FsProviderConfig,
  type FsProviderEndpoint,
  type FsProviderEntry,
  type FsProviderIdentity,
  type FsProviderStore,
  type FsProviderType,
  getProviderId,
  getRuntimeFactory,
  type ProviderModule,
  parseSourceUrl,
  registerRuntimeFactory,
  resolveProviderConfigFromUrl,
  type S3Account,
  type S3Config,
  type S3Credentials,
  type S3Endpoint,
  type S3Identity,
  testConnection,
  testConnection as testProviderConnection,
  toProviderEntry,
  type WebdavAccount,
  type WebdavConfig,
  type WebdavCredentials,
  type WebdavEndpoint,
  type WebdavIdentity,
} from './fs/providers';

// ─── Remote Bindings ─────────────────────────────────────────

export {
  type ConfigLocal,
  ConfigLocalSchema,
  createEmptyConfigLocal,
  type RemoteConfig,
  RemoteConfigSchema,
} from './spec/config-local';
/**
 * @deprecated Use RemoteConfigService via config.local.json instead.
 * These functions read/write localStorage directly and will be removed.
 */
export {
  getAllRemotes,
  getEnabledRemotes,
  getRemote,
  listAllRemotes,
  type NotebookRemoteConfig,
  type RemoteEntry,
  removeRemote,
  setRemote,
  updateProviderIdReferences,
} from './vault/notebook-remotes';
export {
  createRemoteConfigService,
  type RemoteConfigService,
} from './vault/remote-config';
export { getDefaultRemotePath } from './vault/vault-orchestrator';

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
} from './notes/attachment-service';
export {
  createIndexService,
  deleteVaultIndexDatabase,
  type IndexService,
  type NoteIndex,
  NoteIndexSchema,
} from './notes/index-service';
export { createVaultMenuService, type VaultMenuService } from './notes/menu-service';
export {
  flattenMenuItems,
  nestifyMenuItems,
  updateMenuNoteId,
} from './notes/menu-transform';
export { createNoteOp, deleteNoteOp, updateNoteOp } from './notes/note-ops';
export {
  createVaultNoteService,
  type EditAttachment,
  type PendingAttachment,
  type SaveNoteOptions,
  type StagedAttachment,
  type VaultNoteService,
} from './notes/note-service';
export {
  type SearchProvider,
  type SearchResult,
  SimpleSearchProvider,
} from './notes/search-provider';
export { extractTagsFromBody, type ParsedSearchQuery } from './notes/search-query';
export {
  type MenuItemInput,
  type MenuItemUpdate,
  type ReorderUpdate,
  type SyncOutcome,
  VaultOrchestrator,
} from './vault/vault-orchestrator';

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
