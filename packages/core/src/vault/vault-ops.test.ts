import { describe, expect, it } from 'vitest';
import { computeContentHash } from '../spec/hash';
import { SyncLedgerSchema } from '../spec/sync-ledger';
import { META_DIR, metaPath, SYNCABLE_META_FILES } from '../spec/vault-layout';
import { createMemoryProvider } from '../test/memory-fs';
import { appendDeleteLog, initVault } from './vault-ops';

describe('initVault', () => {
  it('writes all required meta files', async () => {
    const fs = createMemoryProvider();
    await initVault(fs, 'proj1', 'My Vault');

    await expect(fs.read(metaPath('manifest'))).resolves.toBeDefined();
    await expect(fs.read(metaPath('menu'))).resolves.toBeDefined();
    await expect(fs.read(metaPath('deleteLog'))).resolves.toBeDefined();
    await expect(fs.read(metaPath('syncLedger'))).resolves.toBeDefined();
  });

  it('writes manifest with correct project_id and name', async () => {
    const fs = createMemoryProvider();
    await initVault(fs, 'proj1', 'My Vault');

    const raw = await fs.read(metaPath('manifest'));
    const manifest = JSON.parse(raw);
    expect(manifest.project_id).toBe('proj1');
    expect(manifest.name).toBe('My Vault');
    expect(manifest.version).toBe('1.0.0');
  });

  it('writes sync-ledger with hashes for all syncable meta files', async () => {
    const fs = createMemoryProvider();
    await initVault(fs, 'proj1', 'My Vault');

    const raw = await fs.read(metaPath('syncLedger'));
    const ledger = SyncLedgerSchema.parse(JSON.parse(raw));

    expect(ledger.version).toBe(1);
    expect(Object.keys(ledger.entities)).toHaveLength(0);

    const metaFileNames = SYNCABLE_META_FILES;
    for (const mf of metaFileNames) {
      expect(ledger.meta_files[mf]).toBeDefined();
      const entry = ledger.meta_files[mf];
      expect(entry).toBeDefined();
      expect('h' in entry).toBe(true);
      expect(typeof (entry as { h: string }).h).toBe('string');
      expect(entry.u).toBeDefined();
    }
  });

  it('sync-ledger meta file hashes match actual file contents', async () => {
    const fs = createMemoryProvider();
    await initVault(fs, 'proj1', 'My Vault');

    const ledgerRaw = await fs.read(metaPath('syncLedger'));
    const ledger = SyncLedgerSchema.parse(JSON.parse(ledgerRaw));

    for (const mf of SYNCABLE_META_FILES) {
      const content = await fs.read(`${META_DIR}/${mf}`);
      const entry = ledger.meta_files[mf];
      const expectedHash = await computeContentHash(content);
      expect((entry as { h: string }).h).toBe(expectedHash);
    }
  });

  it('sync-ledger has consistent timestamps across meta files', async () => {
    const fs = createMemoryProvider();
    await initVault(fs, 'proj1', 'My Vault');

    const ledgerRaw = await fs.read(metaPath('syncLedger'));
    const ledger = SyncLedgerSchema.parse(JSON.parse(ledgerRaw));

    const timestamps = Object.values(ledger.meta_files).map((e) => e.u);
    const unique = [...new Set(timestamps)];
    expect(unique).toHaveLength(1);
  });
});

describe('appendDeleteLog', () => {
  it('appends note id to delete log', async () => {
    const fs = createMemoryProvider();
    await initVault(fs, 'proj1', 'Test');

    await appendDeleteLog(fs, 'note-001');

    const raw = await fs.read(metaPath('deleteLog'));
    const log = JSON.parse(raw);
    expect(log.records['note-001']).toBeDefined();
  });

  it('preserves existing entries when appending', async () => {
    const fs = createMemoryProvider();
    await initVault(fs, 'proj1', 'Test');

    await appendDeleteLog(fs, 'note-001');
    await appendDeleteLog(fs, 'note-002');

    const raw = await fs.read(metaPath('deleteLog'));
    const log = JSON.parse(raw);
    expect(Object.keys(log.records)).toContain('note-001');
    expect(Object.keys(log.records)).toContain('note-002');
  });
});
