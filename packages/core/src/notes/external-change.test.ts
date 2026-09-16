import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { FsClientStat } from '../fs/types';
import { createVaultNoteService, type VaultNoteService } from './note-service';

function createMemoryFs(initial: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initial));
  const stat = (path: string, type: 'file' | 'directory'): FsClientStat => ({
    filename: path,
    basename: path.split('/').pop() ?? path,
    lastmod: '1970-01-01T00:00:00Z',
    size: 0,
    type,
  });
  const list = async (dir: string): Promise<FsClientStat[]> => {
    if (dir === '') {
      const tops = new Set<string>();
      for (const p of files.keys()) tops.add(p.split('/')[0]);
      return [...tops].map((t) => stat(t, files.has(t) ? 'file' : 'directory'));
    }
    const prefix = `${dir}/`;
    const entries = new Set<string>();
    for (const p of files.keys()) {
      if (p.startsWith(prefix)) entries.add(p.slice(prefix.length).split('/')[0]);
    }
    return [...entries].map((e) =>
      stat(`${prefix}${e}`, files.has(`${prefix}${e}`) ? 'file' : 'directory'),
    );
  };
  return {
    files,
    list,
    async read(path: string) {
      const v = files.get(path);
      if (v === undefined) throw new Error(`ENOENT: ${path}`);
      return v;
    },
    async write(path: string, content: string) {
      files.set(path, content);
    },
    async remove(path: string) {
      files.delete(path);
    },
    async exists(path: string) {
      return files.has(path);
    },
    async readBinary() {
      throw new Error('not needed');
    },
    async writeBinary() {
      throw new Error('not needed');
    },
    async ensureDir() {},
    isConfigured: () => true,
  };
}

describe('external change application (note-service)', () => {
  let fs: ReturnType<typeof createMemoryFs>;
  let svc: VaultNoteService;

  beforeEach(async () => {
    fs = createMemoryFs();
    svc = createVaultNoteService({
      async getLocalClient() {
        return fs;
      },
      // biome-ignore lint/suspicious/noExplicitAny: test stub for VaultService
    } as any);
    await svc.activateVault('vTestExt1');
  });

  it('treats own write echoes as unchanged', async () => {
    const created = await svc.createNoteGuarded('vTestExt1', 'hello world');
    expect(await svc.applyExternalChange('vTestExt1', created.noteId)).toBe('unchanged');
  });

  it('detects external edits and refreshes index + search', async () => {
    const created = await svc.createNoteGuarded('vTestExt1', 'original body');
    const path = `${created.noteId.slice(0, 4)}-${created.noteId.slice(4, 6)}/${created.noteId}.md`;
    const raw = fs.files.get(path) ?? '';
    // external editor rewrites the file with new content + newer updated_at
    const edited = raw.replace('original body', 'externally rewritten zebra-unique-term');
    fs.files.set(
      path,
      edited.replace(/^updated_at:.*$/m, `updated_at: ${new Date().toISOString()}`),
    );

    expect(await svc.applyExternalChange('vTestExt1', created.noteId)).toBe('changed');
    expect(await svc.getBody('vTestExt1', created.noteId)).toContain('zebra-unique-term');
    const hits = await svc.searchNotes('zebra-unique-term');
    expect(hits.some((n) => n.id === created.noteId)).toBe(true);
    // second application is a no-op
    expect(await svc.applyExternalChange('vTestExt1', created.noteId)).toBe('unchanged');
  });

  it('reports external deletion and clears the index', async () => {
    const created = await svc.createNoteGuarded('vTestExt1', 'to be removed');
    const path = `${created.noteId.slice(0, 4)}-${created.noteId.slice(4, 6)}/${created.noteId}.md`;
    fs.files.delete(path);

    expect(await svc.applyExternalChange('vTestExt1', created.noteId)).toBe('deleted');
    expect(await svc.getNoteIndex(created.noteId)).toBeUndefined();
  });

  it('keeps last valid view for invalid markdown', async () => {
    const created = await svc.createNoteGuarded('vTestExt1', 'valid body');
    const path = `${created.noteId.slice(0, 4)}-${created.noteId.slice(4, 6)}/${created.noteId}.md`;
    // frontmatter with a date js-yaml auto-converts / bad type → parse failure
    fs.files.set(path, '---\ncreated_at: [broken\n---\nbody');

    expect(await svc.applyExternalChange('vTestExt1', created.noteId)).toBe('invalid');
    expect(await svc.getBody('vTestExt1', created.noteId)).toBe('valid body');
  });

  it('reconciles edits made while the window was closed', async () => {
    const created = await svc.createNoteGuarded('vTestExt1', 'before close');
    const path = `${created.noteId.slice(0, 4)}-${created.noteId.slice(4, 6)}/${created.noteId}.md`;
    const raw = fs.files.get(path) ?? '';
    const edited = raw
      .replace('before close', 'edited while closed unique-reconcile-token')
      .replace(/^updated_at:.*$/m, `updated_at: ${new Date().toISOString()}`);
    fs.files.set(path, edited);

    const changed = await svc.reconcileVault('vTestExt1');
    expect(changed).toEqual([created.noteId]);
    expect(await svc.getBody('vTestExt1', created.noteId)).toContain('unique-reconcile-token');
    // second reconcile is clean
    expect(await svc.reconcileVault('vTestExt1')).toEqual([]);
  });

  it('returns inactive when the vault is not activated', async () => {
    const created = await svc.createNoteGuarded('vTestExt1', 'x');
    expect(await svc.applyExternalChange('vOtherVault', created.noteId)).toBe('inactive');
  });
});

describe('attachment save with revision guard (note-service)', () => {
  let fs: ReturnType<typeof createMemoryFs>;
  let svc: VaultNoteService;

  beforeEach(async () => {
    fs = createMemoryFs();
    svc = createVaultNoteService({
      async getLocalClient() {
        return fs;
      },
      // biome-ignore lint/suspicious/noExplicitAny: test stub for VaultService
    } as any);
    await svc.activateVault('vTestCas1');
  });

  it('rejects the save when the note changed since read', async () => {
    const created = await svc.createNoteGuarded('vTestCas1', 'base body');
    const snapshot = await svc.getNoteSnapshot('vTestCas1', created.noteId);
    if (!snapshot) throw new Error('snapshot missing');

    // someone else (e.g. an agent) updates the note after the editor read it
    await svc.updateNoteGuarded('vTestCas1', created.noteId, { content: 'agent rewrite' }, snapshot.revision);

    await expect(
      svc.saveNoteWithAttachments('vTestCas1', created.noteId, {
        body: 'stale editor body',
        attachments: [],
        removedPaths: [],
        expectedRevision: snapshot.revision,
      }),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });

    // the newer version survives the stale save attempt
    expect(await svc.getBody('vTestCas1', created.noteId)).toContain('agent rewrite');
  });

  it('saves when the revision still matches', async () => {
    const created = await svc.createNoteGuarded('vTestCas1', 'base body');
    const snapshot = await svc.getNoteSnapshot('vTestCas1', created.noteId);
    if (!snapshot) throw new Error('snapshot missing');

    await svc.saveNoteWithAttachments('vTestCas1', created.noteId, {
      body: 'updated body',
      attachments: [],
      removedPaths: [],
      expectedRevision: snapshot.revision,
    });
    expect(await svc.getBody('vTestCas1', created.noteId)).toContain('updated body');
  });
});
