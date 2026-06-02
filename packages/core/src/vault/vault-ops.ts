import type { FsClient } from '../fs/client';
import { createEmptyDeleteLog, type DeleteLog, DeleteLogSchema } from '../spec/delete-log';
import { createManifest } from '../spec/manifest';
import { createMenuData } from '../spec/menu';
import { createEmptySyncLedger } from '../spec/sync-ledger';
import { META_DIR, metaPath } from '../spec/vault-layout';

export async function initVault(
  transport: FsClient,
  projectId: string,
  name: string,
): Promise<void> {
  const now = new Date().toISOString();
  const manifest = createManifest({
    project_id: projectId,
    name,
    created_at: now,
    updated_at: now,
  });

  await transport.ensureDir(META_DIR);
  await transport.write(metaPath('manifest'), JSON.stringify(manifest, null, 2));
  await transport.write(metaPath('menu'), JSON.stringify(createMenuData([], now), null, 2));
  await transport.write(metaPath('deleteLog'), JSON.stringify(createEmptyDeleteLog(now), null, 2));
  await transport.write(metaPath('syncLedger'), JSON.stringify(createEmptySyncLedger(), null, 2));
}

export async function appendDeleteLog(transport: FsClient, noteId: string): Promise<void> {
  let log: DeleteLog;
  try {
    const raw = await transport.read(metaPath('deleteLog'));
    log = DeleteLogSchema.parse(JSON.parse(raw));
  } catch {
    log = createEmptyDeleteLog();
  }
  const now = new Date().toISOString();
  log.records[noteId] = now;
  log.updated_at = now;
  await transport.write(metaPath('deleteLog'), JSON.stringify(log, null, 2));
}
