import { describe, expect, it } from 'vitest';
import { computeContentHash } from '../spec/hash';
import { SyncLedgerSchema } from '../spec/sync-ledger';
import { META_DIR, metaPath, SYNCABLE_META_FILES } from '../spec/vault-layout';
import { createMemoryProvider } from '../test/memory-fs';
import {
  applyDirtyEntries,
  buildEmptyLedger,
  buildLedgerFromFile,
  buildLedgerFromFs,
  type DirtyEntry,
} from './build-ledger';

describe('buildLedgerFromFs', () => {
  it('includes all syncable meta files in ledger', async () => {
    const fs = createMemoryProvider();
    await fs.ensureDir(META_DIR);
    for (const mf of SYNCABLE_META_FILES) {
      await fs.write(
        `${META_DIR}/${mf}`,
        JSON.stringify({ data: mf, updated_at: '2026-01-01T00:00:00Z' }),
      );
    }

    const ledger = await buildLedgerFromFs(fs);

    for (const mf of SYNCABLE_META_FILES) {
      expect(ledger.meta_files[mf]).toBeDefined();
      expect('h' in ledger.meta_files[mf]).toBe(true);
    }
  });

  it('computes correct hashes for meta files', async () => {
    const fs = createMemoryProvider();
    const content = JSON.stringify({ project_id: 'p1', updated_at: '2026-01-01T00:00:00Z' });
    await fs.ensureDir(META_DIR);
    await fs.write(`${META_DIR}/manifest.json`, content);

    const ledger = await buildLedgerFromFs(fs);
    const expectedHash = await computeContentHash(content);
    expect((ledger.meta_files['manifest.json'] as { h: string }).h).toBe(expectedHash);
  });

  it('includes note files in entities', async () => {
    const fs = createMemoryProvider();
    const noteContent = '---\nupdated_at: 2026-06-09T12:00:00Z\n---\nHello';
    await fs.write('2026-06/20260609-120000-1234.md', noteContent);

    const ledger = await buildLedgerFromFs(fs);
    expect(ledger.entities['2026-06/20260609-120000-1234.md']).toBeDefined();
    expect('h' in ledger.entities['2026-06/20260609-120000-1234.md']).toBe(true);
  });

  it('skips invalid note filenames', async () => {
    const fs = createMemoryProvider();
    await fs.write('2026-06/readme.md', 'not a note');

    const ledger = await buildLedgerFromFs(fs);
    expect(ledger.entities['2026-06/readme.md']).toBeUndefined();
  });

  it('returns empty ledger when fs is empty', async () => {
    const fs = createMemoryProvider();
    const ledger = await buildLedgerFromFs(fs);
    expect(Object.keys(ledger.entities)).toHaveLength(0);
    expect(Object.keys(ledger.meta_files)).toHaveLength(0);
  });
});

describe('buildLedgerFromFile', () => {
  it('reads sync-ledger.json from fs', async () => {
    const fs = createMemoryProvider();
    const ledger = {
      version: 1,
      entities: { '2026-01/note.md': { h: 'abc', u: '2026-01-01T00:00:00Z' } },
      meta_files: { 'manifest.json': { h: 'def', u: '2026-01-01T00:00:00Z' } },
    };
    await fs.ensureDir(META_DIR);
    await fs.write(metaPath('syncLedger'), JSON.stringify(ledger));

    const result = await buildLedgerFromFile(fs);
    expect(result.entities['2026-01/note.md']).toBeDefined();
    expect(result.meta_files['manifest.json']).toBeDefined();
  });

  it('throws when sync-ledger.json does not exist', async () => {
    const fs = createMemoryProvider();
    await expect(buildLedgerFromFile(fs)).rejects.toThrow();
  });
});

describe('buildEmptyLedger', () => {
  it('returns a valid empty ledger', () => {
    const ledger = buildEmptyLedger();
    expect(SyncLedgerSchema.safeParse(ledger).success).toBe(true);
    expect(Object.keys(ledger.entities)).toHaveLength(0);
    expect(Object.keys(ledger.meta_files)).toHaveLength(0);
  });
});

describe('applyDirtyEntries', () => {
  it('adds note upsert to entities', async () => {
    const fs = createMemoryProvider();
    const content = '---\nupdated_at: 2026-06-09T12:00:00Z\n---\nHello';
    await fs.write('2026-06/20260609-120000-1234.md', content);

    const base = buildEmptyLedger();
    const dirty: DirtyEntry[] = [
      { type: 'note', path: '2026-06/20260609-120000-1234.md', action: 'upsert' },
    ];

    const updated = await applyDirtyEntries(fs, base, dirty);
    expect(updated.entities['2026-06/20260609-120000-1234.md']).toBeDefined();
    expect('h' in updated.entities['2026-06/20260609-120000-1234.md']).toBe(true);
  });

  it('adds meta upsert to meta_files', async () => {
    const fs = createMemoryProvider();
    const content = JSON.stringify({ items: [], updated_at: '2026-06-09T12:00:00Z' });
    await fs.ensureDir(META_DIR);
    await fs.write(`${META_DIR}/menu.json`, content);

    const base = buildEmptyLedger();
    const dirty: DirtyEntry[] = [{ type: 'meta', key: 'menu.json', action: 'upsert' }];

    const updated = await applyDirtyEntries(fs, base, dirty);
    expect(updated.meta_files['menu.json']).toBeDefined();
    expect('h' in updated.meta_files['menu.json']).toBe(true);
  });

  it('removes note from entities on delete', async () => {
    const fs = createMemoryProvider();
    const base = {
      version: 1 as const,
      entities: {
        '2026-06/20260609-120000-1234.md': { h: 'abc', u: '2026-06-09T12:00:00Z' },
      },
      meta_files: {},
    };

    const dirty: DirtyEntry[] = [
      { type: 'note', path: '2026-06/20260609-120000-1234.md', action: 'delete' },
    ];

    const updated = await applyDirtyEntries(fs, base, dirty);
    expect(updated.entities['2026-06/20260609-120000-1234.md']).toBeUndefined();
  });

  it('handles attachment upsert', async () => {
    const fs = createMemoryProvider();
    const data = new Uint8Array([1, 2, 3]).buffer;
    await fs.writeBinary('assets/ab/abcdef.png', data);

    const base = buildEmptyLedger();
    const dirty: DirtyEntry[] = [
      { type: 'attachment', path: 'assets/ab/abcdef.png', action: 'upsert' },
    ];

    const updated = await applyDirtyEntries(fs, base, dirty);
    expect(updated.entities['assets/ab/abcdef.png']).toBeDefined();
    expect('h' in updated.entities['assets/ab/abcdef.png']).toBe(true);
  });

  it('removes attachment on delete', async () => {
    const fs = createMemoryProvider();
    const base = {
      version: 1 as const,
      entities: {
        'assets/ab/abcdef.png': { h: 'abc', u: '2026-06-09T12:00:00Z' },
      },
      meta_files: {},
    };

    const dirty: DirtyEntry[] = [
      { type: 'attachment', path: 'assets/ab/abcdef.png', action: 'delete' },
    ];

    const updated = await applyDirtyEntries(fs, base, dirty);
    expect(updated.entities['assets/ab/abcdef.png']).toBeUndefined();
  });
});
