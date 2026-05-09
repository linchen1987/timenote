import JSZip from 'jszip';
import { DeleteLogSchema } from '../spec/delete-log';
import { computeContentHash } from '../spec/hash';
import { type Manifest, ManifestSchema } from '../spec/manifest';
import { type NoteId, parseNoteSafe } from '../spec/note';
import { volumeNameFromNoteId } from '../spec/note-id';
import type { SyncEntity, SyncLedger } from '../spec/sync-ledger';
import {
  classifyEntry,
  MAX_ZIP_SIZE,
  META_DIR,
  metaPath,
  SYNCABLE_META_FILES,
} from '../spec/vault-layout';
import type { VaultNoteService } from './note-service';
import { compareEntities, mergeEntities } from './sync-algorithm';
import type { VaultSyncService } from './sync-service';
import type { VaultService } from './vault-service';

export interface ImportResult {
  projectId: string;
  vaultName: string;
  notesCount: number;
  merged: number;
  deleted: number;
  conflicts: number;
  errors: string[];
}

export interface VaultImportService {
  importVault(file: File): Promise<ImportResult>;
  importAndMerge(projectId: string, file: File): Promise<ImportResult>;
  parseManifest(file: File): Promise<Manifest>;
}

export function createVaultImportService(
  vaultService: VaultService,
  noteService: VaultNoteService,
  syncService: VaultSyncService,
): VaultImportService {
  return new VaultImportServiceImpl(vaultService, noteService, syncService);
}

class VaultImportServiceImpl implements VaultImportService {
  constructor(
    private vaultService: VaultService,
    private noteService: VaultNoteService,
    private syncService: VaultSyncService,
  ) {}

  async parseManifest(file: File): Promise<Manifest> {
    if (file.size > MAX_ZIP_SIZE) {
      throw new Error(
        `ZIP file too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum 100MB.`,
      );
    }
    const zip = await JSZip.loadAsync(file);
    const entry = zip.file(metaPath('manifest'));
    if (!entry) throw new Error('Invalid vault ZIP: missing .timenote/manifest.json');
    const raw = await entry.async('string');
    return ManifestSchema.parse(JSON.parse(raw));
  }

  async importVault(file: File): Promise<ImportResult> {
    const { zip, manifest } = await this.parseZip(file);
    const projectId = manifest.project_id;

    const existingVaults = await this.vaultService.listVaults();
    if (existingVaults.some((v) => v.projectId === projectId)) {
      throw new Error(`Vault with ID "${projectId}" already exists.`);
    }

    await this.vaultService.createVaultWithId(projectId, manifest.name);

    return this.doImport(projectId, zip, manifest);
  }

  async importAndMerge(projectId: string, file: File): Promise<ImportResult> {
    const { zip, manifest } = await this.parseZip(file);

    if (manifest.project_id !== projectId) {
      throw new Error(
        `Manifest project_id "${manifest.project_id}" does not match target "${projectId}".`,
      );
    }

    const existing = await this.vaultService.listVaults();
    if (!existing.some((v) => v.projectId === projectId)) {
      throw new Error(`Vault "${projectId}" not found locally. Use importVault for new vaults.`);
    }

    return this.doImport(projectId, zip, manifest);
  }

  private async doImport(projectId: string, zip: JSZip, manifest: Manifest): Promise<ImportResult> {
    const errors: string[] = [];
    const zipLedger = await this.buildZipLedger(zip);
    const localLedger = await this.syncService.buildLocalLedger(projectId);

    const notePlan = compareEntities(localLedger.entities, zipLedger.entities, 'pull');
    const metaPlan = compareEntities(localLedger.meta_files, zipLedger.meta_files, 'pull');

    const local = this.vaultService.getTransport(projectId);
    let pulled = 0;
    let deleted = 0;

    for (const key of notePlan.toPull) {
      try {
        const zipEntry = zip.file(key);
        if (!zipEntry) {
          errors.push(`Pull ${key}: not found in ZIP`);
          continue;
        }
        const content = await zipEntry.async('string');
        const parts = key.split('/');
        if (parts.length > 1) await local.ensureDir(parts[0]);
        await local.write(key, content);
        pulled++;
      } catch (e) {
        errors.push(`Pull ${key}: ${(e as Error).message}`);
      }
    }

    for (const mf of metaPlan.toPull) {
      try {
        const mp = `${META_DIR}/${mf}`;
        const zipEntry = zip.file(mp);
        if (!zipEntry) {
          errors.push(`Pull meta ${mf}: not found in ZIP`);
          continue;
        }
        const content = await zipEntry.async('string');
        await local.ensureDir(META_DIR);
        await local.write(mp, content);
        pulled++;
      } catch (e) {
        errors.push(`Pull meta ${mf}: ${(e as Error).message}`);
      }
    }

    for (const key of notePlan.toDeleteLocal) {
      try {
        await local.remove(key);
        deleted++;
      } catch (e) {
        errors.push(`Delete local ${key}: ${(e as Error).message}`);
      }
    }

    const mergedEntities = mergeEntities(localLedger.entities, zipLedger.entities, notePlan);
    const mergedMeta = mergeEntities(localLedger.meta_files, zipLedger.meta_files, metaPlan);

    const mergedLedger: SyncLedger = {
      version: 1,
      last_sync_time: new Date().toISOString(),
      entities: mergedEntities,
      meta_files: mergedMeta,
    };
    await this.vaultService.writeSyncLedger(projectId, mergedLedger);

    if (pulled > 0 || deleted > 0) {
      await this.noteService.rebuildIndex(projectId);
    }

    return {
      projectId,
      vaultName: manifest.name,
      notesCount: pulled,
      merged: pulled,
      deleted,
      conflicts: notePlan.conflicts + metaPlan.conflicts,
      errors,
    };
  }

  private async buildZipLedger(zip: JSZip): Promise<SyncLedger> {
    const entities: Record<string, SyncEntity> = {};
    const metaFiles: Record<string, SyncEntity> = {};

    const entries: string[] = [];
    zip.forEach((relativePath) => {
      entries.push(relativePath);
    });

    for (const relativePath of entries) {
      if (relativePath.endsWith('/') || relativePath.includes('..')) continue;
      const zipEntry = zip.file(relativePath);
      if (!zipEntry) continue;

      const cls = classifyEntry(relativePath);

      if (cls === 'note') {
        try {
          const content = await zipEntry.async('string');
          const parsed = parseNoteSafe(content);
          const updatedAt = parsed?.frontmatter.updated_at || new Date().toISOString();
          entities[relativePath] = { h: await computeContentHash(content), u: updatedAt };
        } catch {
          // skip unreadable notes
        }
        continue;
      }

      if (cls === 'meta' || cls === 'manifest') {
        const mf = relativePath.replace(`${META_DIR}/`, '');
        try {
          const content = await zipEntry.async('string');
          if (SYNCABLE_META_FILES.includes(mf)) {
            metaFiles[mf] = { h: await computeContentHash(content), u: new Date().toISOString() };
          }
        } catch {
          // skip unreadable meta
        }
      }
    }

    const deleteLogEntry = zip.file(metaPath('deleteLog'));
    if (deleteLogEntry) {
      try {
        const raw = await deleteLogEntry.async('string');
        const deleteLog = DeleteLogSchema.parse(JSON.parse(raw));
        for (const [noteId, deletedAt] of Object.entries(deleteLog.records)) {
          const vol = volumeNameFromNoteId(noteId as NoteId);
          const path = `${vol}/${noteId}.md`;
          if (!entities[path]) {
            entities[path] = { d: true, u: deletedAt };
          }
        }
      } catch {
        // skip invalid delete-log
      }
    }

    return {
      version: 1,
      last_sync_time: new Date().toISOString(),
      entities,
      meta_files: metaFiles,
    };
  }

  private async parseZip(file: File): Promise<{ zip: JSZip; manifest: Manifest }> {
    if (file.size > MAX_ZIP_SIZE) {
      throw new Error(
        `ZIP file too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum 100MB.`,
      );
    }

    const zip = await JSZip.loadAsync(file);
    const manifestEntry = zip.file(metaPath('manifest'));
    if (!manifestEntry) {
      throw new Error('Invalid vault ZIP: missing .timenote/manifest.json');
    }

    const raw = await manifestEntry.async('string');
    let manifest: Manifest;
    try {
      manifest = ManifestSchema.parse(JSON.parse(raw));
    } catch {
      throw new Error('Invalid vault ZIP: manifest.json is not valid');
    }

    return { zip, manifest };
  }
}
