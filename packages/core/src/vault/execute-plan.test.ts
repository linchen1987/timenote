import { describe, expect, it } from 'vitest';
import { createMemoryProvider } from '../test/memory-fs';
import { executePlan, type ExecuteResult } from './execute-plan';
import type { SyncPlan } from './sync-algorithm';
import { META_DIR, metaPath } from '../spec/vault-layout';

describe('executePlan', () => {
  it('pushes note files to remote', async () => {
    const local = createMemoryProvider();
    const remote = createMemoryProvider();
    await local.write('2026-01/20260101-120000-abcd.md', 'note content');

    const plan: SyncPlan = {
      toPull: [],
      toPush: ['2026-01/20260101-120000-abcd.md'],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };

    const result = await executePlan(plan, local, remote);
    expect(result.pushed).toBe(1);
    expect(result.errors).toHaveLength(0);
    await expect(remote.read('2026-01/20260101-120000-abcd.md')).resolves.toBe('note content');
  });

  it('pulls note files from remote', async () => {
    const local = createMemoryProvider();
    const remote = createMemoryProvider();
    await remote.write('2026-01/20260101-120000-abcd.md', 'note content');

    const plan: SyncPlan = {
      toPull: ['2026-01/20260101-120000-abcd.md'],
      toPush: [],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };

    const result = await executePlan(plan, local, remote);
    expect(result.pulled).toBe(1);
    expect(result.errors).toHaveLength(0);
    await expect(local.read('2026-01/20260101-120000-abcd.md')).resolves.toBe('note content');
  });

  it('pushes meta:manifest.json to remote', async () => {
    const local = createMemoryProvider();
    const remote = createMemoryProvider();
    const manifestContent = JSON.stringify({ project_id: 'p1', name: 'test' });
    await local.write(metaPath('manifest'), manifestContent);

    const plan: SyncPlan = {
      toPull: [],
      toPush: ['meta:manifest.json'],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };

    const result = await executePlan(plan, local, remote);
    expect(result.pushed).toBe(1);
    expect(result.errors).toHaveLength(0);
    await expect(remote.read(metaPath('manifest'))).resolves.toBe(manifestContent);
  });

  it('pulls meta:manifest.json from remote', async () => {
    const local = createMemoryProvider();
    const remote = createMemoryProvider();
    const manifestContent = JSON.stringify({ project_id: 'p1', name: 'test' });
    await remote.write(metaPath('manifest'), manifestContent);

    const plan: SyncPlan = {
      toPull: ['meta:manifest.json'],
      toPush: [],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };

    const result = await executePlan(plan, local, remote);
    expect(result.pulled).toBe(1);
    expect(result.errors).toHaveLength(0);
    await expect(local.read(metaPath('manifest'))).resolves.toBe(manifestContent);
  });

  it('handles mixed push with notes and meta files', async () => {
    const local = createMemoryProvider();
    const remote = createMemoryProvider();
    await local.write('2026-01/20260101-120000-abcd.md', 'note');
    await local.write(metaPath('manifest'), '{"project_id":"p1"}');
    await local.write(metaPath('menu'), '{"items":[]}');

    const plan: SyncPlan = {
      toPull: [],
      toPush: [
        '2026-01/20260101-120000-abcd.md',
        'meta:manifest.json',
        'meta:menu.json',
      ],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };

    const result = await executePlan(plan, local, remote);
    expect(result.pushed).toBe(3);
    expect(result.errors).toHaveLength(0);
    await expect(remote.read(metaPath('manifest'))).resolves.toBeDefined();
    await expect(remote.read(metaPath('menu'))).resolves.toBeDefined();
    await expect(remote.read('2026-01/20260101-120000-abcd.md')).resolves.toBe('note');
  });

  it('skips push operations when direction is pull', async () => {
    const local = createMemoryProvider();
    const remote = createMemoryProvider();
    await local.write(metaPath('manifest'), '{"project_id":"p1"}');

    const plan: SyncPlan = {
      toPull: [],
      toPush: ['meta:manifest.json'],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };

    const result = await executePlan(plan, local, remote, { direction: 'pull' });
    expect(result.pushed).toBe(0);
    await expect(remote.read(metaPath('manifest'))).rejects.toThrow();
  });

  it('skips pull operations when direction is push', async () => {
    const local = createMemoryProvider();
    const remote = createMemoryProvider();
    await remote.write(metaPath('manifest'), '{"project_id":"p1"}');

    const plan: SyncPlan = {
      toPull: ['meta:manifest.json'],
      toPush: [],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };

    const result = await executePlan(plan, local, remote, { direction: 'push' });
    expect(result.pulled).toBe(0);
    await expect(local.read(metaPath('manifest'))).rejects.toThrow();
  });

  it('deletes local files for toDeleteLocal entries', async () => {
    const local = createMemoryProvider();
    const remote = createMemoryProvider();
    await local.write('2026-01/20260101-120000-abcd.md', 'old note');

    const plan: SyncPlan = {
      toPull: [],
      toPush: [],
      toDeleteLocal: ['2026-01/20260101-120000-abcd.md'],
      toDeleteRemote: [],
      conflicts: 0,
    };

    const result = await executePlan(plan, local, remote);
    expect(result.pulled).toBe(1);
    await expect(local.read('2026-01/20260101-120000-abcd.md')).rejects.toThrow();
  });

  it('pushes binary attachment files', async () => {
    const local = createMemoryProvider();
    const remote = createMemoryProvider();
    const data = new Uint8Array([1, 2, 3, 4]).buffer;
    await local.writeBinary('assets/ab/abcdef.png', data);

    const plan: SyncPlan = {
      toPull: [],
      toPush: ['assets/ab/abcdef.png'],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };

    const result = await executePlan(plan, local, remote);
    expect(result.pushed).toBe(1);
    expect(result.errors).toHaveLength(0);
    const pulled = await remote.readBinary('assets/ab/abcdef.png');
    expect(new Uint8Array(pulled)).toEqual(new Uint8Array(data));
  });

  it('creates intermediate directories when pushing notes', async () => {
    const local = createMemoryProvider();
    const remote = createMemoryProvider();
    await local.write('2026-06/20260609-120000-test.md', 'content');

    const plan: SyncPlan = {
      toPull: [],
      toPush: ['2026-06/20260609-120000-test.md'],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };

    const result = await executePlan(plan, local, remote);
    expect(result.pushed).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});
