import JSZip from 'jszip';
import type { VaultService } from './vault-service';

const SYNC_LEDGER_FILE = 'sync-ledger.json';
const TIMENOTE_DIR = '.timenote';

export interface VaultExportService {
  exportVault(projectId: string): Promise<Blob>;
  downloadVault(projectId: string): Promise<void>;
}

export function createVaultExportService(vaultService: VaultService): VaultExportService {
  return new VaultExportServiceImpl(vaultService);
}

class VaultExportServiceImpl implements VaultExportService {
  constructor(private vaultService: VaultService) {}

  async exportVault(projectId: string): Promise<Blob> {
    const transport = this.vaultService.getOpfsTransport(projectId);
    const zip = new JSZip();

    await this.addDirectoryToZip(zip, transport, '');

    const manifest = await this.vaultService.readManifest(projectId);
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    void manifest;
    return zipBlob;
  }

  async downloadVault(projectId: string): Promise<void> {
    const manifest = await this.vaultService.readManifest(projectId);
    const blob = await this.exportVault(projectId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${manifest.name}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async addDirectoryToZip(
    zip: JSZip,
    transport: ReturnType<VaultService['getOpfsTransport']>,
    dirPath: string,
  ): Promise<void> {
    const entries = await transport.list(dirPath);

    for (const entry of entries) {
      const fullPath = dirPath ? `${dirPath}/${entry.basename}` : entry.basename;

      if (entry.type === 'directory') {
        await this.addDirectoryToZip(zip, transport, fullPath);
      } else {
        if (this.shouldSkip(fullPath)) continue;
        const content = await transport.read(fullPath);
        zip.file(fullPath, content);
      }
    }
  }

  private shouldSkip(filePath: string): boolean {
    if (filePath === `${TIMENOTE_DIR}/${SYNC_LEDGER_FILE}`) return true;
    return false;
  }
}
