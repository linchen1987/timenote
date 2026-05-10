import { describe, expect, it } from 'vitest';
import type { SyncEntity, SyncLedger } from '../spec/sync-ledger';
import { createSyncLedger } from '../spec/sync-ledger';
import { compareEntities, mergeEntities, resolve, type SyncPlan } from './sync-algorithm';

function alive(hash: string, updated: string): SyncEntity {
  return { h: hash, u: updated };
}

function tombstone(updated: string): SyncEntity {
  return { d: true, u: updated };
}

function makeLedger(
  entities: Record<string, SyncEntity> = {},
  metaFiles: Record<string, SyncEntity> = {},
): SyncLedger {
  return createSyncLedger(entities, metaFiles);
}

describe('compareEntities', () => {
  it('local-only alive → push', () => {
    const local = { 'a.md': alive('h1', '2026-01-01T00:00:00Z') };
    const plan = compareEntities(local, {}, 'both');
    expect(plan.toPush).toEqual(['a.md']);
    expect(plan.toPull).toEqual([]);
    expect(plan.conflicts).toBe(0);
  });

  it('local-only tombstone → delete remote', () => {
    const local = { 'a.md': tombstone('2026-01-01T00:00:00Z') };
    const plan = compareEntities(local, {}, 'both');
    expect(plan.toDeleteRemote).toEqual(['a.md']);
    expect(plan.toPush).toEqual([]);
  });

  it('remote-only alive → pull', () => {
    const remote = { 'a.md': alive('h1', '2026-01-01T00:00:00Z') };
    const plan = compareEntities({}, remote, 'both');
    expect(plan.toPull).toEqual(['a.md']);
    expect(plan.toPush).toEqual([]);
  });

  it('remote-only tombstone → delete local', () => {
    const remote = { 'a.md': tombstone('2026-01-01T00:00:00Z') };
    const plan = compareEntities({}, remote, 'both');
    expect(plan.toDeleteLocal).toEqual(['a.md']);
    expect(plan.toPull).toEqual([]);
  });

  it('same hash → no action', () => {
    const local = { 'a.md': alive('h1', '2026-01-01T00:00:00Z') };
    const remote = { 'a.md': alive('h1', '2026-01-02T00:00:00Z') };
    const plan = compareEntities(local, remote, 'both');
    expect(plan.toPull).toEqual([]);
    expect(plan.toPush).toEqual([]);
    expect(plan.conflicts).toBe(0);
  });

  it('different hash, local newer → push (conflict)', () => {
    const local = { 'a.md': alive('h1', '2026-01-02T00:00:00Z') };
    const remote = { 'a.md': alive('h2', '2026-01-01T00:00:00Z') };
    const plan = compareEntities(local, remote, 'both');
    expect(plan.toPush).toEqual(['a.md']);
    expect(plan.conflicts).toBe(1);
  });

  it('different hash, remote newer → pull (conflict)', () => {
    const local = { 'a.md': alive('h1', '2026-01-01T00:00:00Z') };
    const remote = { 'a.md': alive('h2', '2026-01-02T00:00:00Z') };
    const plan = compareEntities(local, remote, 'both');
    expect(plan.toPull).toEqual(['a.md']);
    expect(plan.conflicts).toBe(1);
  });

  it('alive vs tombstone: local newer → push', () => {
    const local = { 'a.md': alive('h1', '2026-01-02T00:00:00Z') };
    const remote = { 'a.md': tombstone('2026-01-01T00:00:00Z') };
    const plan = compareEntities(local, remote, 'both');
    expect(plan.toPush).toEqual(['a.md']);
    expect(plan.conflicts).toBe(1);
  });

  it('alive vs tombstone: remote newer → delete local', () => {
    const local = { 'a.md': alive('h1', '2026-01-01T00:00:00Z') };
    const remote = { 'a.md': tombstone('2026-01-02T00:00:00Z') };
    const plan = compareEntities(local, remote, 'both');
    expect(plan.toDeleteLocal).toEqual(['a.md']);
    expect(plan.conflicts).toBe(1);
  });

  it('tombstone vs alive: local newer → delete remote', () => {
    const local = { 'a.md': tombstone('2026-01-02T00:00:00Z') };
    const remote = { 'a.md': alive('h1', '2026-01-01T00:00:00Z') };
    const plan = compareEntities(local, remote, 'both');
    expect(plan.toDeleteRemote).toEqual(['a.md']);
    expect(plan.conflicts).toBe(1);
  });

  it('tombstone vs alive: remote newer → pull', () => {
    const local = { 'a.md': tombstone('2026-01-01T00:00:00Z') };
    const remote = { 'a.md': alive('h1', '2026-01-02T00:00:00Z') };
    const plan = compareEntities(local, remote, 'both');
    expect(plan.toPull).toEqual(['a.md']);
    expect(plan.conflicts).toBe(1);
  });

  it('pull-only mode: does not push or delete remote', () => {
    const local = { 'a.md': alive('h1', '2026-01-01T00:00:00Z') };
    const remote = { 'b.md': alive('h2', '2026-01-01T00:00:00Z') };
    const plan = compareEntities(local, remote, 'pull');
    expect(plan.toPush).toEqual([]);
    expect(plan.toDeleteRemote).toEqual([]);
    expect(plan.toPull).toEqual(['b.md']);
  });

  it('push-only mode: does not pull or delete local', () => {
    const local = { 'a.md': alive('h1', '2026-01-01T00:00:00Z') };
    const remote = { 'b.md': alive('h2', '2026-01-01T00:00:00Z') };
    const plan = compareEntities(local, remote, 'push');
    expect(plan.toPull).toEqual([]);
    expect(plan.toDeleteLocal).toEqual([]);
    expect(plan.toPush).toEqual(['a.md']);
  });

  it('multiple keys with mixed scenarios', () => {
    const local: Record<string, SyncEntity> = {
      'a.md': alive('h1', '2026-01-01T00:00:00Z'),
      'b.md': alive('h1', '2026-01-01T00:00:00Z'),
      'c.md': tombstone('2026-01-01T00:00:00Z'),
    };
    const remote: Record<string, SyncEntity> = {
      'a.md': alive('h2', '2026-01-02T00:00:00Z'),
      'b.md': alive('h1', '2026-01-01T00:00:00Z'),
      'd.md': alive('h3', '2026-01-01T00:00:00Z'),
    };
    const plan = compareEntities(local, remote, 'both');
    expect(plan.toPull).toContain('a.md');
    expect(plan.toPull).toContain('d.md');
    expect(plan.toDeleteRemote).toContain('c.md');
    expect(plan.conflicts).toBe(1);
  });

  it('empty maps → empty plan', () => {
    const plan = compareEntities({}, {}, 'both');
    expect(plan.toPull).toEqual([]);
    expect(plan.toPush).toEqual([]);
    expect(plan.toDeleteLocal).toEqual([]);
    expect(plan.toDeleteRemote).toEqual([]);
    expect(plan.conflicts).toBe(0);
  });
});

describe('mergeEntities', () => {
  it('uses remote for pulled keys', () => {
    const local = { 'a.md': alive('h1', '2026-01-01T00:00:00Z') };
    const remote = { 'a.md': alive('h2', '2026-01-02T00:00:00Z') };
    const plan: SyncPlan = {
      toPull: ['a.md'],
      toPush: [],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };
    const merged = mergeEntities(local, remote, plan);
    expect(merged['a.md']).toEqual({ h: 'h2', u: '2026-01-02T00:00:00Z' });
  });

  it('uses local for pushed keys', () => {
    const local = { 'a.md': alive('h1', '2026-01-02T00:00:00Z') };
    const remote = { 'a.md': alive('h2', '2026-01-01T00:00:00Z') };
    const plan: SyncPlan = {
      toPull: [],
      toPush: ['a.md'],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };
    const merged = mergeEntities(local, remote, plan);
    expect(merged['a.md']).toEqual({ h: 'h1', u: '2026-01-02T00:00:00Z' });
  });

  it('keeps local for unchanged keys', () => {
    const local = { 'a.md': alive('h1', '2026-01-01T00:00:00Z') };
    const remote = { 'a.md': alive('h1', '2026-01-01T00:00:00Z') };
    const plan: SyncPlan = {
      toPull: [],
      toPush: [],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };
    const merged = mergeEntities(local, remote, plan);
    expect(merged['a.md']).toEqual({ h: 'h1', u: '2026-01-01T00:00:00Z' });
  });

  it('merges keys only in remote', () => {
    const remote = { 'b.md': alive('h2', '2026-01-01T00:00:00Z') };
    const plan: SyncPlan = {
      toPull: [],
      toPush: [],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };
    const merged = mergeEntities({}, remote, plan);
    expect(merged['b.md']).toEqual({ h: 'h2', u: '2026-01-01T00:00:00Z' });
  });

  it('handles complex merge with multiple operations', () => {
    const local: Record<string, SyncEntity> = {
      'a.md': alive('h1', '2026-01-01T00:00:00Z'),
      'b.md': alive('h1', '2026-01-01T00:00:00Z'),
      'c.md': alive('h1', '2026-01-01T00:00:00Z'),
    };
    const remote: Record<string, SyncEntity> = {
      'a.md': alive('h2', '2026-01-02T00:00:00Z'),
      'b.md': alive('h1', '2026-01-01T00:00:00Z'),
      'd.md': alive('h3', '2026-01-01T00:00:00Z'),
    };
    const plan: SyncPlan = {
      toPull: ['a.md'],
      toPush: [],
      toDeleteLocal: [],
      toDeleteRemote: [],
      conflicts: 0,
    };
    const merged = mergeEntities(local, remote, plan);
    expect((merged['a.md'] as { h: string }).h).toBe('h2');
    expect((merged['b.md'] as { h: string }).h).toBe('h1');
    expect((merged['c.md'] as { h: string }).h).toBe('h1');
    expect((merged['d.md'] as { h: string }).h).toBe('h3');
  });
});

describe('resolve', () => {
  it('combines note and meta plans into unified SyncPlan', () => {
    const local = makeLedger({ 'a.md': alive('h1', '2026-01-01T00:00:00Z') }, {});
    const remote = makeLedger(
      {
        'a.md': alive('h2', '2026-01-02T00:00:00Z'),
        'b.md': alive('h3', '2026-01-01T00:00:00Z'),
      },
      { 'menu.json': alive('hm1', '2026-01-01T00:00:00Z') },
    );

    const session = resolve(local, remote, 'pull');

    expect(session.plan.toPull).toContain('a.md');
    expect(session.plan.toPull).toContain('b.md');
    expect(session.plan.toPull).toContain('meta:menu.json');
    expect(session.plan.conflicts).toBe(1);

    expect(session.mergedLedger.entities['a.md']).toEqual({ h: 'h2', u: '2026-01-02T00:00:00Z' });
    expect(session.mergedLedger.entities['b.md']).toEqual({ h: 'h3', u: '2026-01-01T00:00:00Z' });
    expect(session.mergedLedger.meta_files['menu.json']).toEqual({
      h: 'hm1',
      u: '2026-01-01T00:00:00Z',
    });
  });

  it('empty ledgers produce empty plan and ledger', () => {
    const session = resolve(makeLedger(), makeLedger(), 'both');
    expect(session.plan.toPull).toEqual([]);
    expect(session.plan.toPush).toEqual([]);
    expect(session.plan.toDeleteLocal).toEqual([]);
    expect(session.plan.toDeleteRemote).toEqual([]);
    expect(session.plan.conflicts).toBe(0);
    expect(Object.keys(session.mergedLedger.entities)).toHaveLength(0);
  });

  it('pull direction skips push actions', () => {
    const local = makeLedger({ 'a.md': alive('h1', '2026-01-01T00:00:00Z') });
    const remote = makeLedger();

    const session = resolve(local, remote, 'pull');
    expect(session.plan.toPush).toEqual([]);
  });

  it('push direction skips pull actions', () => {
    const local = makeLedger();
    const remote = makeLedger({ 'a.md': alive('h1', '2026-01-01T00:00:00Z') });

    const session = resolve(local, remote, 'push');
    expect(session.plan.toPull).toEqual([]);
  });
});
