import JSZip from 'jszip';
import { isValidNoteFilename, isValidVolumeName } from './note-id';
import type { VaultNoteService } from './note-service';
import { ManifestSchema } from './types';
import type { VaultService } from './vault-service';

const TIMENOTE_DIR = '.timenote';
const MANIFEST_FILE = 'manifest.json';
const MENU_FILE = 'menu.json';
const DELETE_LOG_FILE = 'delete-log.json';
const VALID_META_FILES = new Set([
  `${TIMENOTE_DIR}/${MANIFEST_FILE}`,
  `${TIMENOTE_DIR}/${MENU_FILE}`,
  `${TIMENOTE_DIR}/${DELETE_LOG_FILE}`,
]);
const MAX_ZIP_SIZE = 100 * 1024 * 1024;

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

    const manifestData = zip.file(`${TIMENOTE_DIR}/${MANIFEST_FILE}`);
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
    const transport = this.vaultService.getOpfsTransport(newProjectId);

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

      if (VALID_META_FILES.has(relativePath)) {
        if (relativePath === `${TIMENOTE_DIR}/${MANIFEST_FILE}`) continue;
        const content = await zipEntry.async('string');
        await transport.write(relativePath, content);
        continue;
      }

      const parts = relativePath.split('/');
      if (parts.length === 2 && isValidVolumeName(parts[0]) && isValidNoteFilename(parts[1])) {
        const content = await zipEntry.async('string');
        await transport.ensureDir(parts[0]);
        await transport.write(relativePath, content);
        notesCount++;
        continue;
      }

      if (!relativePath.startsWith(TIMENOTE_DIR)) {
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
