import type { FsTransport } from '../fs/transport';
import type { SyncLedger } from '../spec/sync-ledger';
import { META_DIR, syncLedgerPath } from '../spec/vault-layout';

export async function writeLedger(fs: FsTransport, ledger: SyncLedger): Promise<void> {
  await fs.ensureDir(META_DIR);
  await fs.write(syncLedgerPath(), JSON.stringify(ledger, null, 2));
}
