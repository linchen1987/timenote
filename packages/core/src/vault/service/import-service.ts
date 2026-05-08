import JSZip from 'jszip';
import { ManifestSchema } from '../spec/manifest';
import { classifyEntry, MAX_ZIP_SIZE, META_DIR, metaPath } from '../spec/vault-layout';
import type { VaultNoteService } from './note-service';
import type { VaultService } from './vault-service';

export interface ImportResult {
  projectId: string;
  vaultName: string;
  notesCount: number;
  errors: string[];
}

export interface VaultImportService {
  importVault(file: File): Promise<ImportResult>;
}

export function createVaultImportService(
  vaultService: VaultService,
  noteService: VaultNoteService,
): VaultImportService {
  return new VaultImportServiceImpl(vaultService, noteService);
}

class VaultImportServiceImpl implements VaultImportService {
  constructor(
    private vaultService: VaultService,
    private noteService: VaultNoteService,
  ) {}

  async importVault(file: File): Promise<ImportResult> {
    if (file.size > MAX_ZIP_SIZE) {
      throw new Error(
        `ZIP file too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum 100MB.`,
      );
    }

    const zip = await JSZip.loadAsync(file);
    const errors: string[] = [];

    const manifestData = zip.file(metaPath('manifest'));
    if (!manifestData) {
      throw new Error('Invalid vault ZIP: missing .timenote/manifest.json');
    }

    const manifestRaw = await manifestData.async('string');
    let manifest: { project_id: string; name: string; version: string };
    try {
      const parsed = JSON.parse(manifestRaw);
      manifest = ManifestSchema.parse(parsed);
    } catch {
      throw new Error('Invalid vault ZIP: manifest.json is not valid');
    }

    const existingVaults = await this.vaultService.listVaults();
    if (existingVaults.some((v) => v.projectId === manifest.project_id)) {
      throw new Error(
        `Vault with ID "${manifest.project_id}" already exists. Import would overwrite existing data.`,
      );
    }

    const newProjectId = await this.vaultService.createVault(manifest.name);
    const transport = this.vaultService.getTransport(newProjectId);

    let notesCount = 0;
    const zipEntries: string[] = [];
    zip.forEach((relativePath) => {
      zipEntries.push(relativePath);
    });

    for (const relativePath of zipEntries) {
      if (relativePath.endsWith('/')) continue;

      if (relativePath.includes('..')) {
        errors.push(`Skipped suspicious path: ${relativePath}`);
        continue;
      }

      const zipEntry = zip.file(relativePath);
      if (!zipEntry) continue;

      const entryClass = classifyEntry(relativePath);

      if (entryClass === 'manifest') continue;

      if (entryClass === 'meta') {
        const content = await zipEntry.async('string');
        await transport.write(relativePath, content);
        continue;
      }

      if (entryClass === 'note') {
        const content = await zipEntry.async('string');
        const parts = relativePath.split('/');
        await transport.ensureDir(parts[0]);
        await transport.write(relativePath, content);
        notesCount++;
        continue;
      }

      if (!relativePath.startsWith(META_DIR)) {
        errors.push(`Skipped unrecognized file: ${relativePath}`);
      }
    }

    const newManifest = await this.vaultService.readManifest(newProjectId);
    await this.noteService.rebuildIndex(newProjectId);

    return {
      projectId: newProjectId,
      vaultName: newManifest.name,
      notesCount,
      errors,
    };
  }
}
