import type { SyncLedger } from '../spec/sync-ledger';
import { META_DIR, syncLedgerPath } from '../spec/vault-layout';
import type { VaultFs } from './vault-fs';

export async function writeLedger(fs: VaultFs, ledger: SyncLedger): Promise<void> {
  await fs.ensureDir(META_DIR);
  await fs.write(syncLedgerPath(), JSON.stringify(ledger, null, 2));
}
