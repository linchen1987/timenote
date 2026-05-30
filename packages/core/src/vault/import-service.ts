import JSZip from 'jszip';
import type { FsStat, FsTransport } from '../fs/transport';
import type { VaultNoteService } from '../service/note-service';
import { type Manifest, ManifestSchema } from '../spec/manifest';
import { MAX_ZIP_SIZE, metaPath } from '../spec/vault-layout';
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
  parseManifest(file: File): Promise<Manifest>;
}

export function createVaultImportService(
  vaultService: VaultService,
  noteService: VaultNoteService,
  syncService: VaultSyncService,
): VaultImportService {
  return new VaultImportServiceImpl(vaultService, noteService, syncService);
}

export function detectZipRootPrefix(zip: JSZip): string {
  if (zip.file(metaPath('manifest'))) return '';

  const allPaths: string[] = [];
  zip.forEach((path) => {
    allPaths.push(path);
  });

  const roots = new Set<string>();
  for (const path of allPaths) {
    if (path === metaPath('manifest')) continue;
    const slashIdx = path.indexOf('/');
    if (slashIdx < 0) continue;
    const root = path.slice(0, slashIdx + 1);
    if (path === `${root}${metaPath('manifest')}`) return root;
    roots.add(root);
  }

  for (const root of roots) {
    if (zip.file(`${root}${metaPath('manifest')}`)) return root;
  }

  return '';
}

class VaultImportServiceImpl implements VaultImportService {
  constructor(
    private vaultService: VaultService,
    _noteService: VaultNoteService,
    private syncService: VaultSyncService,
  ) {}

  async parseManifest(file: File): Promise<Manifest> {
    const { manifest } = await this.parseZip(file);
    return manifest;
  }

  async importVault(file: File): Promise<ImportResult> {
    const { zip, manifest, rootPrefix } = await this.parseZip(file);
    const projectId = manifest.project_id;

    const existingVaults = await this.vaultService.listVaults();
    const exists = existingVaults.some((v) => v.projectId === projectId);

    if (!exists) {
      await this.vaultService.createVaultWithId(projectId, manifest.name);
    }

    const zipFs = this.createZipVaultFs(zip, rootPrefix);

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

  private createZipVaultFs(zip: JSZip, rootPrefix: string): FsTransport {
    const prefix = rootPrefix;
    const resolvePath = (path: string) => (prefix ? `${prefix}${path}` : path);

    return {
      async read(path: string): Promise<string> {
        const entry = zip.file(resolvePath(path));
        if (!entry) throw new Error(`File not found in ZIP: ${resolvePath(path)}`);
        return entry.async('string');
      },
      async write(): Promise<void> {
        throw new Error('ZipVaultFs is read-only');
      },
      async readBinary(path: string): Promise<ArrayBuffer> {
        const entry = zip.file(resolvePath(path));
        if (!entry) throw new Error(`File not found in ZIP: ${resolvePath(path)}`);
        return entry.async('arraybuffer');
      },
      async writeBinary(): Promise<void> {
        throw new Error('ZipVaultFs is read-only');
      },
      async remove(): Promise<void> {
        throw new Error('ZipVaultFs is read-only');
      },
      async list(dirPath: string): Promise<FsStat[]> {
        const entries: FsStat[] = [];
        const listPrefix = dirPath ? `${resolvePath(dirPath)}/` : prefix || '';
        const seen = new Set<string>();

        zip.forEach((relativePath) => {
          if (relativePath.endsWith('/') || relativePath.includes('..')) return;

          if (listPrefix && !relativePath.startsWith(listPrefix)) return;

          const rest = relativePath.slice(listPrefix.length);
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
        return zip.file(resolvePath(path)) !== null;
      },
      async ensureDir(): Promise<void> {},
    };
  }

  private async parseZip(file: File): Promise<{
    zip: JSZip;
    manifest: Manifest;
    rootPrefix: string;
  }> {
    if (file.size > MAX_ZIP_SIZE) {
      throw new Error(
        `ZIP file too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum 100MB.`,
      );
    }

    const zip = await JSZip.loadAsync(file);
    const rootPrefix = detectZipRootPrefix(zip);

    const manifestEntry = zip.file(`${rootPrefix}${metaPath('manifest')}`);
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

    return { zip, manifest, rootPrefix };
  }
}
