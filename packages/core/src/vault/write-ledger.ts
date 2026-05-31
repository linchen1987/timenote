import type { FsProvider } from '../fs/provider';
import type { SyncLedger } from '../spec/sync-ledger';
import { META_DIR, syncLedgerPath } from '../spec/vault-layout';

export async function writeLedger(fs: FsProvider, ledger: SyncLedger): Promise<void> {
  await fs.ensureDir(META_DIR);
  await fs.write(syncLedgerPath(), JSON.stringify(ledger, null, 2));
}
