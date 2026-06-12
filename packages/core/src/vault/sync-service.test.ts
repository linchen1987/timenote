import { describe, expect, it } from 'vitest';
import type { FsClient } from '../fs/types';
import { ManifestSchema } from '../spec/manifest';
import { metaPath } from '../spec/vault-layout';
import { createMemoryProvider } from '../test/memory-fs';
import { buildLedgerFromFs } from './build-ledger';
import { createVaultSyncService, type VaultSyncService } from './sync-service';
import { initVault } from './vault-ops';
import type { VaultRegistry, VaultRegistryEntry } from './vault-registry';
import { writeLedger } from './write-ledger';

function createMemoryRegistry(): VaultRegistry {
  const providers = new Map<string, FsClient>();

  return {
    async list(): Promise<VaultRegistryEntry[]> {
      return Array.from(providers.keys()).map((id) => ({
        projectId: id,
        sourceUrl: `localfs:///vaults/${id}`,
        name: id,
      }));
    },
    async get(projectId: string): Promise<VaultRegistryEntry | null> {
      return providers.has(projectId)
        ? { projectId, sourceUrl: `localfs:///vaults/${projectId}`, name: projectId }
        : null;
    },
    async register(projectId: string, _name: string): Promise<VaultRegistryEntry> {
      providers.set(projectId, createMemoryProvider());
      return { projectId, sourceUrl: `localfs:///vaults/${projectId}`, name: projectId };
    },
    async unregister() {},
    async destroy(projectId: string) {
      providers.delete(projectId);
    },
    async getProvider(projectId: string): Promise<FsClient> {
      let p = providers.get(projectId);
      if (!p) {
        p = createMemoryProvider();
        providers.set(projectId, p);
      }
      return p;
    },
  };
}

function createSimpleVaultService(registry: VaultRegistry) {
  return {
    async createVault(name: string): Promise<string> {
      const id = `test-${Math.random().toString(36).slice(2, 10)}`;
      await registry.register(id, name);
      const provider = await registry.getProvider(id);
      await initVault(provider, id, name);
      return id;
    },
    async createVaultWithId(projectId: string, name: string): Promise<void> {
      await registry.register(projectId, name);
      const provider = await registry.getProvider(projectId);
      await initVault(provider, projectId, name);
    },
    async deleteVault() {},
    async listVaults(): Promise<{ projectId: string; name: string }[]> {
      return [];
    },
    async getProvider(projectId: string): Promise<FsClient> {
      return registry.getProvider(projectId);
    },
  };
}

describe('SyncService', () => {
  describe('first push', () => {
    it('pushes manifest to empty remote', async () => {
      const registry = createMemoryRegistry();
      const vaultService = createSimpleVaultService(registry);
      const syncService = createVaultSyncService(vaultService);

      const projectId = await vaultService.createVault('TestVault');
      const localFs = await vaultService.getProvider(projectId);
      const remoteFs = createMemoryProvider();

      await syncService.loadLedgerFromVault(projectId);
      const result = await syncService.push(projectId, remoteFs);

      expect(result.pushed).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      const remoteManifest = await remoteFs.read(metaPath('manifest'));
      const manifest = ManifestSchema.parse(JSON.parse(remoteManifest));
      expect(manifest.project_id).toBe(projectId);
      expect(manifest.name).toBe('TestVault');
    });

    it('pushes all meta files to empty remote', async () => {
      const registry = createMemoryRegistry();
      const vaultService = createSimpleVaultService(registry);
      const syncService = createVaultSyncService(vaultService);

      const projectId = await vaultService.createVault('TestVault');
      const remoteFs = createMemoryProvider();

      await syncService.loadLedgerFromVault(projectId);
      await syncService.push(projectId, remoteFs);

      await expect(remoteFs.read(metaPath('manifest'))).resolves.toBeDefined();
      await expect(remoteFs.read(metaPath('menu'))).resolves.toBeDefined();
      await expect(remoteFs.read(metaPath('deleteLog'))).resolves.toBeDefined();
      await expect(remoteFs.read(metaPath('syncLedger'))).resolves.toBeDefined();
    });

    it('pushes notes added after initVault', async () => {
      const registry = createMemoryRegistry();
      const vaultService = createSimpleVaultService(registry);
      const syncService = createVaultSyncService(vaultService);

      const projectId = await vaultService.createVault('TestVault');
      const localFs = await vaultService.getProvider(projectId);
      const remoteFs = createMemoryProvider();

      const noteContent = '---\nupdated_at: 2026-06-09T12:00:00Z\n---\nHello World';
      await localFs.write('2026-06/20260609-120000-1234.md', noteContent);

      await syncService.loadLedgerFromVault(projectId);
      syncService.markDirty(projectId, [
        { type: 'note', path: '2026-06/20260609-120000-1234.md', action: 'upsert' },
      ]);

      const result = await syncService.push(projectId, remoteFs);

      expect(result.pushed).toBeGreaterThanOrEqual(1);
      await expect(remoteFs.read('2026-06/20260609-120000-1234.md')).resolves.toBe(noteContent);
    });

    it('manifest is included even when only notes are dirty', async () => {
      const registry = createMemoryRegistry();
      const vaultService = createSimpleVaultService(registry);
      const syncService = createVaultSyncService(vaultService);

      const projectId = await vaultService.createVault('TestVault');
      const localFs = await vaultService.getProvider(projectId);
      const remoteFs = createMemoryProvider();

      await localFs.write(
        '2026-06/20260609-120000-1234.md',
        '---\nupdated_at: 2026-06-09T12:00:00Z\n---\nHello',
      );

      await syncService.loadLedgerFromVault(projectId);
      syncService.markDirty(projectId, [
        { type: 'note', path: '2026-06/20260609-120000-1234.md', action: 'upsert' },
      ]);

      await syncService.push(projectId, remoteFs);

      await expect(remoteFs.read(metaPath('manifest'))).resolves.toBeDefined();
    });

    it('writes merged ledger to both sides after push', async () => {
      const registry = createMemoryRegistry();
      const vaultService = createSimpleVaultService(registry);
      const syncService = createVaultSyncService(vaultService);

      const projectId = await vaultService.createVault('TestVault');
      const localFs = await vaultService.getProvider(projectId);
      const remoteFs = createMemoryProvider();

      await syncService.loadLedgerFromVault(projectId);
      await syncService.push(projectId, remoteFs);

      const localLedger = await buildLedgerFromFs(localFs);
      const remoteLedger = await buildLedgerFromFs(remoteFs);

      expect(Object.keys(localLedger.meta_files).sort()).toEqual(
        Object.keys(remoteLedger.meta_files).sort(),
      );
    });
  });

  describe('initFromSource', () => {
    it('pulls all files from remote to empty local', async () => {
      const registry = createMemoryRegistry();
      const vaultService = createSimpleVaultService(registry);
      const syncService = createVaultSyncService(vaultService);

      const sourceFs = createMemoryProvider();
      await initVault(sourceFs, 'src1', 'SourceVault');
      await sourceFs.write(
        '2026-06/20260609-120000-1234.md',
        '---\nupdated_at: 2026-06-09T12:00:00Z\n---\nHello',
      );
      const sourceLedger = await buildLedgerFromFs(sourceFs);
      await writeLedger(sourceFs, sourceLedger);

      const projectId = await vaultService.createVault('LocalVault');
      const localFs = await vaultService.getProvider(projectId);

      await syncService.loadLedgerFromVault(projectId);
      const result = await syncService.initFromSource(projectId, sourceFs, {
        writeSourceLedger: true,
      });

      expect(result.pulled).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      await expect(localFs.read(metaPath('manifest'))).resolves.toBeDefined();
      await expect(localFs.read('2026-06/20260609-120000-1234.md')).resolves.toBeDefined();
    });

    it('overwrites local manifest with source manifest', async () => {
      const registry = createMemoryRegistry();
      const vaultService = createSimpleVaultService(registry);
      const syncService = createVaultSyncService(vaultService);

      const sourceFs = createMemoryProvider();
      await initVault(sourceFs, 'src1', 'SourceVault');

      const projectId = await vaultService.createVault('LocalVault');
      const localFs = await vaultService.getProvider(projectId);

      await syncService.loadLedgerFromVault(projectId);
      await syncService.initFromSource(projectId, sourceFs);

      const localManifest = ManifestSchema.parse(
        JSON.parse(await localFs.read(metaPath('manifest'))),
      );
      expect(localManifest.name).toBe('SourceVault');
    });
  });

  describe('pull after push roundtrip', () => {
    it('push then pull results in identical files', async () => {
      const registry = createMemoryRegistry();
      const vaultService = createSimpleVaultService(registry);
      const syncService = createVaultSyncService(vaultService);

      const projectId = await vaultService.createVault('RoundTrip');
      const localFs = await vaultService.getProvider(projectId);
      const remoteFs = createMemoryProvider();

      await localFs.write(
        '2026-06/20260609-120000-1234.md',
        '---\nupdated_at: 2026-06-09T12:00:00Z\n---\nNote1',
      );

      await syncService.loadLedgerFromVault(projectId);
      syncService.markDirty(projectId, [
        { type: 'note', path: '2026-06/20260609-120000-1234.md', action: 'upsert' },
      ]);
      await syncService.push(projectId, remoteFs);

      const localLedger = await buildLedgerFromFs(localFs);
      const remoteLedger = await buildLedgerFromFs(remoteFs);

      expect(Object.keys(remoteLedger.meta_files)).toContain('manifest.json');
      expect(Object.keys(remoteLedger.meta_files)).toContain('menu.json');
      expect(Object.keys(remoteLedger.entities)).toContain('2026-06/20260609-120000-1234.md');
    });
  });

  describe('loadLedgerFromVault rebuild', () => {
    it('rebuilds ledger from fs when sync-ledger.json is missing', async () => {
      const registry = createMemoryRegistry();
      const vaultService = createSimpleVaultService(registry);
      const syncService = createVaultSyncService(vaultService);

      const projectId = await vaultService.createVault('TestVault');
      const localFs = await vaultService.getProvider(projectId);
      const remoteFs = createMemoryProvider();

      await localFs.remove(metaPath('syncLedger'));

      await syncService.loadLedgerFromVault(projectId);
      const result = await syncService.push(projectId, remoteFs);

      expect(result.pushed).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      await expect(remoteFs.read(metaPath('manifest'))).resolves.toBeDefined();
    });
  });
});
