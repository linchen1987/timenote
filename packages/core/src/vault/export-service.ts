import JSZip from 'jszip';
import type { VaultSyncService } from './sync-service';
import type { VaultService } from './vault-service';

export interface VaultExportService {
  exportVault(projectId: string): Promise<Blob>;
  downloadVault(projectId: string): Promise<void>;
}

export function createVaultExportService(
  vaultService: VaultService,
  syncService: VaultSyncService,
): VaultExportService {
  return new VaultExportServiceImpl(vaultService, syncService);
}

class VaultExportServiceImpl implements VaultExportService {
  constructor(
    private vaultService: VaultService,
    private syncService: VaultSyncService,
  ) {}

  async exportVault(projectId: string): Promise<Blob> {
    const zip = new JSZip();
    const zipFs = createZipWriteFs(zip);

    await this.syncService.syncWithSource(projectId, zipFs, {
      direction: 'push',
      writeSourceLedger: false,
      localLedgerMode: 'incremental',
    });

    return zip.generateAsync({ type: 'blob' });
  }

  async downloadVault(projectId: string): Promise<void> {
    const manifest = await this.vaultService.readManifest(projectId);
    const blob = await this.exportVault(projectId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    a.download = `${manifest.name}_${ts}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

function createZipWriteFs(zip: JSZip) {
  const SYNC_LEDGER_PREFIX = '.timenote/sync-ledger.json';

  return {
    async read(path: string): Promise<string> {
      const entry = zip.file(path);
      if (!entry) throw new Error(`File not found in ZIP: ${path}`);
      return entry.async('string');
    },
    async write(path: string, content: string): Promise<void> {
      if (path === SYNC_LEDGER_PREFIX) return;
      zip.file(path, content);
    },
    async readBinary(path: string): Promise<ArrayBuffer> {
      const entry = zip.file(path);
      if (!entry) throw new Error(`File not found in ZIP: ${path}`);
      return entry.async('arraybuffer');
    },
    async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
      zip.file(path, data);
    },
    async remove(): Promise<void> {},
    async list(): Promise<never[]> {
      return [];
    },
    async exists(): Promise<boolean> {
      return false;
    },
    async ensureDir(): Promise<void> {},
  };
}
