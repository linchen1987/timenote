import JSZip from 'jszip';
import { syncLedgerPath } from '../spec/vault-layout';
import type { VaultService, VaultTransport } from './vault-service';

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
    const transport = this.vaultService.getTransport(projectId);
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
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    a.download = `${manifest.name}_${ts}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async addDirectoryToZip(
    zip: JSZip,
    transport: VaultTransport,
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
    if (filePath === syncLedgerPath()) return true;
    return false;
  }
}
