import JSZip from 'jszip';
import type { FsStat } from '../../fs/types';
import type { VaultNoteService } from '../service/note-service';
import { type Manifest, ManifestSchema } from '../spec/manifest';
import { MAX_ZIP_SIZE, metaPath } from '../spec/vault-layout';
import type { VaultSyncService } from './sync-service';
import type { VaultFs } from './vault-fs';
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
    _noteService: VaultNoteService,
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
    if (!entry) throw new Error(`Invalid vault ZIP: missing ${metaPath('manifest')}`);
    const raw = await entry.async('string');
    return ManifestSchema.parse(JSON.parse(raw));
  }

  async importVault(file: File): Promise<ImportResult> {
    const { zip, manifest } = await this.parseZip(file);
    const projectId = manifest.project_id;

    const existingVaults = await this.vaultService.listVaults();
    const exists = existingVaults.some((v) => v.projectId === projectId);

    if (!exists) {
      await this.vaultService.createVaultWithId(projectId, manifest.name);
    }

    const zipFs = this.createZipVaultFs(zip);

    const syncResult = exists
      ? await this.syncService.syncWithSource(projectId, zipFs, {
          direction: 'pull',
          writeSourceLedger: false,
          localLedgerMode: 'incremental',
        })
      : await this.syncService.initFromSource(projectId, zipFs, {
          writeSourceLedger: false,
        });

    return {
      projectId,
      vaultName: manifest.name,
      notesCount: syncResult.pulled,
      merged: syncResult.pulled,
      deleted: 0,
      conflicts: syncResult.conflicts,
      errors: syncResult.errors,
    };
  }

  private createZipVaultFs(zip: JSZip): VaultFs {
    return {
      async read(path: string): Promise<string> {
        const entry = zip.file(path);
        if (!entry) throw new Error(`File not found in ZIP: ${path}`);
        return entry.async('string');
      },
      async write(): Promise<void> {
        throw new Error('ZipVaultFs is read-only');
      },
      async remove(): Promise<void> {
        throw new Error('ZipVaultFs is read-only');
      },
      async list(dirPath: string): Promise<FsStat[]> {
        const entries: FsStat[] = [];
        const prefix = dirPath ? `${dirPath}/` : '';
        const seen = new Set<string>();

        zip.forEach((relativePath) => {
          if (relativePath.endsWith('/') || relativePath.includes('..')) return;

          if (prefix && !relativePath.startsWith(prefix)) return;

          const rest = relativePath.slice(prefix.length);
          const parts = rest.split('/');
          const name = parts[0];

          if (!name || seen.has(name)) return;
          seen.add(name);

          if (parts.length === 1) {
            entries.push({
              filename: `${dirPath}/${name}`,
              basename: name,
              lastmod: '',
              size: 0,
              type: 'file',
            });
          } else {
            entries.push({
              filename: `${dirPath}/${name}`,
              basename: name,
              lastmod: '',
              size: 0,
              type: 'directory',
            });
          }
        });

        return entries;
      },
      async exists(path: string): Promise<boolean> {
        return zip.file(path) !== null;
      },
      async ensureDir(): Promise<void> {},
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
      throw new Error(`Invalid vault ZIP: missing ${metaPath('manifest')}`);
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
