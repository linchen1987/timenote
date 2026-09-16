import { describe, expect, it } from 'vitest';
import {
  computeNoteRevision,
  createNoteGuarded,
  deleteNoteGuarded,
  readNoteSnapshot,
  updateNoteGuarded,
} from './agent-note-ops';
import { AutomationOperationError } from './contracts';
import { draftRegistry } from './draft-registry';
import { createMutationQueue } from './mutation-queue';

function createMemoryTransport(initial: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initial));
  const transport = {
    async read(path: string) {
      const content = files.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
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
  };
  return { transport, files };
}

describe('readNoteSnapshot', () => {
  it('returns null for missing notes', async () => {
    const { transport } = createMemoryTransport();
    expect(await readNoteSnapshot(transport, '20260521-143022-7891')).toBeNull();
  });

  it('computes revision from raw content', async () => {
    const { transport } = createMemoryTransport();
    const { noteId, raw, revision } = await createNoteGuarded(transport, '# hello');
    const snapshot = await readNoteSnapshot(transport, noteId);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.revision).toBe(revision);
    expect(snapshot?.body).toBe('# hello');
    expect(snapshot?.raw).toBe(raw);
  });
});

describe('createNoteGuarded', () => {
  it('creates a note with frontmatter and tags', async () => {
    const { transport } = createMemoryTransport();
    const created = await createNoteGuarded(transport, '# Title\n\n#tag1 #tag2\n');
    expect(created.noteId).toMatch(/^\d{8}-\d{6}-\d{4}$/);
    expect(created.raw).toContain('#tag1');
    const snapshot = await readNoteSnapshot(transport, created.noteId);
    expect(snapshot?.tags).toEqual(['tag1', 'tag2']);
    expect(created.revision).toBe(await computeNoteRevision(created.raw));
  });

  it('replays idempotently with a pre-allocated noteId after a crash', async () => {
    const { transport } = createMemoryTransport();
    const first = await createNoteGuarded(transport, 'same operation', {
      noteId: '20260521-143022-7891',
    });
    expect(first.noteId).toBe('20260521-143022-7891');

    // retry after response loss: same pre-allocated id → same committed state,
    // no duplicate note
    const replay = await createNoteGuarded(transport, 'same operation', {
      noteId: '20260521-143022-7891',
      idempotent: true,
    });
    expect(replay.noteId).toBe('20260521-143022-7891');
    expect(replay.revision).toBe(first.revision);
    expect(replay.raw).toBe(first.raw);
  });

  it('rejects non-idempotent use of an occupied noteId', async () => {
    const { transport } = createMemoryTransport();
    const first = await createNoteGuarded(transport, 'first');
    const err = await createNoteGuarded(transport, 'second', {
      noteId: first.noteId,
    }).catch((e: unknown) => e);
    expect((err as Error).message).toContain('collision');
  });
});

describe('updateNoteGuarded', () => {
  it('rejects stale revisions with REVISION_CONFLICT and current revision', async () => {
    const { transport } = createMemoryTransport();
    const created = await createNoteGuarded(transport, 'v1');
    await updateNoteGuarded(transport, created.noteId, { content: 'v2' }, created.revision);

    const err = await updateNoteGuarded(
      transport,
      created.noteId,
      { content: 'v3' },
      created.revision,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AutomationOperationError);
    expect((err as AutomationOperationError).code).toBe('REVISION_CONFLICT');
    expect((err as AutomationOperationError).details?.currentRevision).toBeDefined();
  });

  it('appends content when append is set', async () => {
    const { transport } = createMemoryTransport();
    const created = await createNoteGuarded(transport, 'base');
    const result = await updateNoteGuarded(
      transport,
      created.noteId,
      { append: '-extra' },
      created.revision,
    );
    const snapshot = await readNoteSnapshot(transport, created.noteId);
    expect(snapshot?.body).toBe('base-extra');
    expect(result.revision).toBe(snapshot?.revision);
  });

  it('preserves frontmatter fields it does not manage', async () => {
    const { transport, files } = createMemoryTransport();
    const created = await createNoteGuarded(transport, 'v1');
    const path = `${created.noteId.slice(0, 4)}-${created.noteId.slice(4, 6)}/${created.noteId}.md`;
    // simulate an external edit adding a custom field and an attachment ref
    const custom = created.raw.replace(
      '---\n',
      '---\ntype: meeting\nattachments:\n  - path: assets/a.png\n',
    );
    files.set(path, custom);
    const customRevision = await computeNoteRevision(custom);

    const result = await updateNoteGuarded(
      transport,
      created.noteId,
      { content: 'v2' },
      customRevision,
    );
    expect(result.revision).not.toBe(customRevision);
    const snapshot = await readNoteSnapshot(transport, created.noteId);
    expect(snapshot?.body).toBe('v2');
    expect(snapshot?.frontmatter.type).toBe('meeting');
    expect(snapshot?.attachments).toEqual([{ path: 'assets/a.png' }]);
  });
});

describe('deleteNoteGuarded', () => {
  it('writes tombstone before removing the file', async () => {
    const { transport, files } = createMemoryTransport();
    const created = await createNoteGuarded(transport, 'bye');
    const order: string[] = [];

    await deleteNoteGuarded(
      {
        ...transport,
        async remove(path: string) {
          order.push('remove');
          await transport.remove(path);
        },
      },
      async () => {
        order.push('tombstone');
      },
      created.noteId,
      created.revision,
    );

    expect(order).toEqual(['tombstone', 'remove']);
    expect(files.size).toBe(0);
  });

  it('rejects delete with stale revision', async () => {
    const { transport } = createMemoryTransport();
    const created = await createNoteGuarded(transport, 'x');
    await updateNoteGuarded(transport, created.noteId, { content: 'changed' }, created.revision);
    const err = await deleteNoteGuarded(
      transport,
      async () => {},
      created.noteId,
      created.revision,
    ).catch((e: unknown) => e);
    expect((err as AutomationOperationError).code).toBe('REVISION_CONFLICT');
  });

  it('NOTE_NOT_FOUND for missing notes', async () => {
    const { transport } = createMemoryTransport();
    const err = await deleteNoteGuarded(
      transport,
      async () => {},
      '20260521-143022-7891',
      'sha256:x',
    ).catch((e: unknown) => e);
    expect((err as AutomationOperationError).code).toBe('NOTE_NOT_FOUND');
  });
});

describe('mutation queue', () => {
  it('serializes operations per key', async () => {
    const queue = createMutationQueue();
    const events: string[] = [];
    const task = (name: string, delay: number) =>
      queue.run('vault-1', async () => {
        events.push(`${name}:start`);
        await new Promise((r) => setTimeout(r, delay));
        events.push(`${name}:end`);
      });

    await Promise.all([task('a', 20), task('b', 5)]);
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('continues after a failed task', async () => {
    const queue = createMutationQueue();
    const events: string[] = [];
    await queue
      .run('k', async () => {
        throw new Error('boom');
      })
      .catch(() => {});
    await queue.run('k', async () => {
      events.push('ok');
    });
    expect(events).toEqual(['ok']);
  });
});

describe('draft registry', () => {
  it('tracks dirty state per note', () => {
    draftRegistry.clear();
    draftRegistry.register('vA', '20260521-143022-7891');
    expect(draftRegistry.hasDirtyDraft('vA', '20260521-143022-7891')).toBe(false);
    draftRegistry.setDirty('vA', '20260521-143022-7891', true);
    expect(draftRegistry.hasDirtyDraft('vA', '20260521-143022-7891')).toBe(true);
    expect(draftRegistry.hasDirtyDraft('vB', '20260521-143022-7891')).toBe(false);
    expect(draftRegistry.getDirtyNoteIds('vA')).toEqual(['20260521-143022-7891']);
    draftRegistry.unregister('vA', '20260521-143022-7891');
    expect(draftRegistry.hasDirtyDraft('vA', '20260521-143022-7891')).toBe(false);
  });
});
