import type { FsClient } from '../fs/types';
import { createEmptyDeleteLog, type DeleteLog, DeleteLogSchema } from '../spec/delete-log';
import { computeContentHash } from '../spec/hash';
import { createManifest } from '../spec/manifest';
import { createMenuData } from '../spec/menu';
import { createSyncLedger, type SyncEntity } from '../spec/sync-ledger';
import { META_DIR, metaPath, SYNCABLE_META_FILES } from '../spec/vault-layout';

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

  const manifestJson = JSON.stringify(manifest, null, 2);
  const menuJson = JSON.stringify(createMenuData([], now), null, 2);
  const deleteLogJson = JSON.stringify(createEmptyDeleteLog(now), null, 2);

  await transport.ensureDir(META_DIR);
  await transport.write(metaPath('manifest'), manifestJson);
  await transport.write(metaPath('menu'), menuJson);
  await transport.write(metaPath('deleteLog'), deleteLogJson);

  const metaFiles: Record<string, SyncEntity> = {};
  const metaContents: Record<string, string> = {
    'manifest.json': manifestJson,
    'menu.json': menuJson,
    'delete-log.json': deleteLogJson,
  };
  for (const mf of SYNCABLE_META_FILES) {
    const content = metaContents[mf];
    if (content) {
      metaFiles[mf] = { h: await computeContentHash(content), u: now };
    }
  }

  const ledger = createSyncLedger({}, metaFiles);
  await transport.write(metaPath('syncLedger'), JSON.stringify(ledger, null, 2));
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
