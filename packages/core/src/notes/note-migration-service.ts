import type { FsClient } from '../fs/types';
import { parseNote } from '../spec/note';
import { noteFilePath } from '../spec/vault-layout';
import { appendDeleteLog } from '../vault/vault-ops';
import type { VaultService } from '../vault/vault-service';

const NOTE_ID_RANDOM_DIGITS = 10;

export interface NoteMigrationRequest {
  sourceProjectId: string;
  targetProjectId: string;
  noteId: string;
}

export type NoteMigrationResult =
  | { status: 'completed'; targetNoteId: string }
  | { status: 'target_created_source_retained'; targetNoteId: string; error: string };

export interface VaultNoteMigrationService {
  migrateNote(request: NoteMigrationRequest): Promise<NoteMigrationResult>;
}

export function createVaultNoteMigrationService(
  vaultService: VaultService,
): VaultNoteMigrationService {
  return new VaultNoteMigrationServiceImpl(vaultService);
}

class VaultNoteMigrationServiceImpl implements VaultNoteMigrationService {
  constructor(private readonly vaultService: VaultService) {}

  async migrateNote(request: NoteMigrationRequest): Promise<NoteMigrationResult> {
    const { sourceProjectId, targetProjectId, noteId } = request;
    if (sourceProjectId === targetProjectId) {
      throw new Error('Source and target notebooks must be different');
    }

    const vaults = await this.vaultService.listVaults();
    const projectIds = new Set(vaults.map((vault) => vault.projectId));
    if (!projectIds.has(sourceProjectId) || !projectIds.has(targetProjectId)) {
      throw new Error('Source or target notebook is not available locally');
    }

    const source = await this.vaultService.getLocalClient(sourceProjectId);
    const target = await this.vaultService.getLocalClient(targetProjectId);
    const sourcePath = noteFilePath(noteId);
    if (!(await source.exists(sourcePath))) throw new Error(`Note not found: ${noteId}`);

    const raw = await source.read(sourcePath);
    const parsed = parseNote(raw);
    const attachmentPaths =
      parsed.frontmatter.attachments?.map((attachment) => attachment.path) ?? [];
    const targetNoteId = await this.resolveTargetNoteId(target, noteId);

    for (const path of attachmentPaths) {
      if (!path.startsWith('assets/')) throw new Error(`Invalid attachment path: ${path}`);
      if (await target.exists(path)) continue;
      if (!(await source.exists(path))) throw new Error(`Attachment not found: ${path}`);
      const data = await source.readBinary(path);
      const dir = path.split('/').slice(0, -1).join('/');
      if (dir) await target.ensureDir(dir);
      await target.writeBinary(path, data);
    }

    await target.write(noteFilePath(targetNoteId), raw);

    try {
      await source.remove(sourcePath);
      await appendDeleteLog(source, noteId);
    } catch (error) {
      if (!(await source.exists(sourcePath))) throw error;
      return {
        status: 'target_created_source_retained',
        targetNoteId,
        error: (error as Error).message,
      };
    }

    try {
      await this.removeOrphanedAttachments(source, attachmentPaths);
    } catch (error) {
      console.error('[migrateNote] source attachment cleanup failed:', error);
    }
    return { status: 'completed', targetNoteId };
  }

  private async resolveTargetNoteId(target: FsClient, sourceNoteId: string): Promise<string> {
    const prefix = sourceNoteId.slice(0, -1);
    const candidates = this.shuffledDigits(sourceNoteId.at(-1) ?? '0').map(
      (digit) => `${prefix}${digit}`,
    );
    for (const candidate of candidates) {
      if (!(await target.exists(noteFilePath(candidate)))) return candidate;
    }
    throw new Error('Target notebook has no available note ID for this timestamp');
  }

  private shuffledDigits(preferred: string): string[] {
    const digits = Array.from({ length: NOTE_ID_RANDOM_DIGITS }, (_, index) => String(index));
    const others = digits.filter((digit) => digit !== preferred);
    for (let index = others.length - 1; index > 0; index -= 1) {
      const targetIndex = Math.floor(Math.random() * (index + 1));
      [others[index], others[targetIndex]] = [others[targetIndex], others[index]];
    }
    return [preferred, ...others];
  }

  private async removeOrphanedAttachments(source: FsClient, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const referenced = new Set<string>();
    const volumes = await source.list('');
    for (const volume of volumes) {
      if (volume.type !== 'directory' || !/^\d{4}-\d{2}$/.test(volume.basename)) continue;
      for (const entry of await source.list(volume.basename)) {
        if (entry.type !== 'file' || !/\.md$/.test(entry.basename)) continue;
        try {
          const note = parseNote(await source.read(entry.filename));
          for (const attachment of note.frontmatter.attachments ?? [])
            referenced.add(attachment.path);
        } catch {
          // Ignore unrelated or malformed files while checking attachment references.
        }
      }
    }
    await Promise.all(
      paths.filter((path) => !referenced.has(path)).map((path) => source.remove(path)),
    );
  }
}
