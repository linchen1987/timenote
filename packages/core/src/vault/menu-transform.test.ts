import { describe, expect, it } from 'vitest';
import { flattenMenuItems, nestifyMenuItems, updateMenuNoteId } from './menu-transform';
import type { MenuItem, RuntimeMenuItem } from './types';

describe('flattenMenuItems', () => {
  it('flattens simple flat menu', () => {
    const items: MenuItem[] = [
      { title: 'Note 1', type: 'note', note_id: 'aaa' },
      { title: 'Note 2', type: 'note', note_id: 'bbb' },
    ];

    const result = flattenMenuItems(items);
    expect(result).toHaveLength(2);
    expect(result[0].parentId).toBeNull();
    expect(result[0].order).toBe(0);
    expect(result[0].title).toBe('Note 1');
    expect(result[0].note_id).toBe('aaa');
    expect(result[1].order).toBe(1);
    expect(result[1].parentId).toBeNull();
  });

  it('flattens nested menu with correct parent references', () => {
    const items: MenuItem[] = [
      {
        title: 'Parent',
        type: 'note',
        note_id: 'parent1',
        children: [
          { title: 'Child 1', type: 'note', note_id: 'child1' },
          { title: 'Child 2', type: 'note', note_id: 'child2' },
        ],
      },
    ];

    const result = flattenMenuItems(items);
    expect(result).toHaveLength(3);

    const parent = result[0];
    expect(parent.parentId).toBeNull();
    expect(parent.title).toBe('Parent');

    const child1 = result[1];
    expect(child1.parentId).toBe(parent.id);
    expect(child1.title).toBe('Child 1');

    const child2 = result[2];
    expect(child2.parentId).toBe(parent.id);
    expect(child2.title).toBe('Child 2');
  });

  it('flattens deeply nested menu', () => {
    const items: MenuItem[] = [
      {
        title: 'L1',
        type: 'note',
        note_id: '1',
        children: [
          {
            title: 'L2',
            type: 'note',
            note_id: '2',
            children: [{ title: 'L3', type: 'note', note_id: '3' }],
          },
        ],
      },
    ];

    const result = flattenMenuItems(items);
    expect(result).toHaveLength(3);

    const l2 = result.find((r) => r.title === 'L2')!;
    const l3 = result.find((r) => r.title === 'L3')!;
    expect(l3.parentId).toBe(l2.id);
  });

  it('handles search items', () => {
    const items: MenuItem[] = [{ title: 'Search 1', type: 'search', search: 'query1' }];

    const result = flattenMenuItems(items);
    expect(result[0].type).toBe('search');
    expect(result[0].search).toBe('query1');
    expect(result[0].note_id).toBeUndefined();
  });

  it('handles empty items', () => {
    expect(flattenMenuItems([])).toEqual([]);
  });
});

describe('nestifyMenuItems', () => {
  it('converts flat items to nested structure', () => {
    const flatItems: RuntimeMenuItem[] = [
      { id: 'a', parentId: null, order: 0, title: 'Note 1', type: 'note', note_id: 'aaa' },
      { id: 'b', parentId: null, order: 1, title: 'Note 2', type: 'note', note_id: 'bbb' },
    ];

    const result = nestifyMenuItems(flatItems);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Note 1');
    expect(result[0].note_id).toBe('aaa');
    expect(result[0].children).toBeUndefined();
  });

  it('converts nested flat items correctly', () => {
    const flatItems: RuntimeMenuItem[] = [
      { id: 'parent', parentId: null, order: 0, title: 'Parent', type: 'note', note_id: 'p1' },
      { id: 'child1', parentId: 'parent', order: 0, title: 'Child 1', type: 'note', note_id: 'c1' },
      { id: 'child2', parentId: 'parent', order: 1, title: 'Child 2', type: 'note', note_id: 'c2' },
    ];

    const result = nestifyMenuItems(flatItems);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Parent');
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children?.[0].title).toBe('Child 1');
    expect(result[0].children?.[1].title).toBe('Child 2');
  });

  it('respects order', () => {
    const flatItems: RuntimeMenuItem[] = [
      { id: 'b', parentId: null, order: 1, title: 'Second', type: 'note', note_id: 'b' },
      { id: 'a', parentId: null, order: 0, title: 'First', type: 'note', note_id: 'a' },
    ];

    const result = nestifyMenuItems(flatItems);
    expect(result[0].title).toBe('First');
    expect(result[1].title).toBe('Second');
  });

  it('handles search items', () => {
    const flatItems: RuntimeMenuItem[] = [
      { id: 's', parentId: null, order: 0, title: 'Search', type: 'search', search: 'query' },
    ];

    const result = nestifyMenuItems(flatItems);
    expect(result[0].type).toBe('search');
    expect(result[0].search).toBe('query');
  });

  it('handles empty items', () => {
    expect(nestifyMenuItems([])).toEqual([]);
  });
});

describe('round-trip: flatten → nestify', () => {
  it('preserves structure through flatten → nestify', () => {
    const original: MenuItem[] = [
      {
        title: '工作',
        type: 'note',
        note_id: '20260425-121000-1234',
        children: [{ title: '子笔记', type: 'note', note_id: '20260425-130000-5678' }],
      },
      { title: '搜索', type: 'search', search: 'test query' },
    ];

    const flat = flattenMenuItems(original);
    const nested = nestifyMenuItems(flat);

    expect(nested).toHaveLength(2);
    expect(nested[0].title).toBe('工作');
    expect(nested[0].children).toHaveLength(1);
    expect(nested[0].children?.[0].title).toBe('子笔记');
    expect(nested[1].title).toBe('搜索');
    expect(nested[1].search).toBe('test query');
  });
});

describe('updateMenuNoteId', () => {
  it('updates note IDs based on mapping', () => {
    const items: MenuItem[] = [
      { title: 'Note', type: 'note', note_id: 'old-id' },
      {
        title: 'Parent',
        type: 'note',
        note_id: 'old-parent',
        children: [{ title: 'Child', type: 'note', note_id: 'old-child' }],
      },
    ];

    const mapping = {
      'old-id': 'new-id',
      'old-parent': 'new-parent',
      'old-child': 'new-child',
    };

    const result = updateMenuNoteId(items, mapping);
    expect(result[0].note_id).toBe('new-id');
    expect(result[1].note_id).toBe('new-parent');
    expect(result[1].children?.[0].note_id).toBe('new-child');
  });

  it('preserves unmapped IDs', () => {
    const items: MenuItem[] = [{ title: 'Note', type: 'note', note_id: 'keep-me' }];

    const result = updateMenuNoteId(items, {});
    expect(result[0].note_id).toBe('keep-me');
  });

  it('preserves search items', () => {
    const items: MenuItem[] = [{ title: 'Search', type: 'search', search: 'query' }];

    const result = updateMenuNoteId(items, { x: 'y' });
    expect(result[0].type).toBe('search');
    expect(result[0].search).toBe('query');
  });
});
