import { describe, expect, it } from 'vitest';
import {
  DeleteLogSchema,
  ManifestSchema,
  MenuDataSchema,
  NoteFilenameSchema,
  NoteFrontmatterSchema,
  NoteIdSchema,
  SyncEntitySchema,
  SyncLedgerSchema,
  VolumeNameSchema,
} from './types';

describe('NoteIdSchema', () => {
  it('accepts valid note IDs', () => {
    expect(NoteIdSchema.parse('20260425-121000-1234')).toBe('20260425-121000-1234');
  });

  it('rejects invalid note IDs', () => {
    expect(() => NoteIdSchema.parse('abc')).toThrow();
    expect(() => NoteIdSchema.parse('')).toThrow();
    expect(() => NoteIdSchema.parse('20260425-121000-123')).toThrow();
  });
});

describe('VolumeNameSchema', () => {
  it('accepts valid volume names', () => {
    expect(VolumeNameSchema.parse('2026-04')).toBe('2026-04');
  });

  it('rejects invalid volume names', () => {
    expect(() => VolumeNameSchema.parse('2026-4')).toThrow();
    expect(() => VolumeNameSchema.parse('26-04')).toThrow();
  });
});

describe('NoteFilenameSchema', () => {
  it('accepts valid note filenames', () => {
    expect(NoteFilenameSchema.parse('20260425-121000-1234.md')).toBe('20260425-121000-1234.md');
    expect(NoteFilenameSchema.parse('20260425-121000-1234.png')).toBe('20260425-121000-1234.png');
  });

  it('rejects invalid filenames', () => {
    expect(() => NoteFilenameSchema.parse('readme.md')).toThrow();
    expect(() => NoteFilenameSchema.parse('20260425-121000-1234')).toThrow();
  });
});

describe('ManifestSchema', () => {
  it('parses valid manifest', () => {
    const data = {
      project_id: 'v-abc123',
      name: 'My Notes',
      version: '1.0.0',
      created_at: '2026-04-25T12:10:00Z',
      updated_at: '2026-04-25T12:10:00Z',
    };
    expect(ManifestSchema.parse(data)).toEqual(data);
  });

  it('rejects invalid version', () => {
    const data = {
      project_id: 'v-abc',
      name: 'Test',
      version: '2.0.0',
      created_at: '2026-04-25T12:10:00Z',
      updated_at: '2026-04-25T12:10:00Z',
    };
    expect(() => ManifestSchema.parse(data)).toThrow();
  });

  it('rejects missing fields', () => {
    expect(() => ManifestSchema.parse({ project_id: 'v-abc' })).toThrow();
  });
});

describe('MenuDataSchema', () => {
  it('parses valid menu with note items', () => {
    const data = {
      version: 1,
      items: [
        {
          title: '工作',
          type: 'note',
          note_id: '20260425-121000-1234',
        },
      ],
    };
    expect(MenuDataSchema.parse(data)).toEqual(data);
  });

  it('parses valid menu with search items', () => {
    const data = {
      version: 1,
      items: [{ title: '搜索', type: 'search', search: 'query' }],
    };
    expect(MenuDataSchema.parse(data)).toEqual(data);
  });

  it('parses nested menu', () => {
    const data = {
      version: 1,
      items: [
        {
          title: 'Parent',
          type: 'note',
          note_id: 'parent1',
          children: [{ title: 'Child', type: 'note', note_id: 'child1' }],
        },
      ],
    };
    expect(MenuDataSchema.parse(data)).toEqual(data);
  });

  it('rejects invalid version', () => {
    const data = { version: 2, items: [] };
    expect(() => MenuDataSchema.parse(data)).toThrow();
  });
});

describe('DeleteLogSchema', () => {
  it('parses valid delete log', () => {
    const data = {
      version: 1,
      records: {
        '20260425-112010-1234': '2026-04-26T10:00:00Z',
        '20260420-080000-5678': '2026-04-26T11:30:00Z',
      },
    };
    expect(DeleteLogSchema.parse(data)).toEqual(data);
  });

  it('rejects invalid date format in records', () => {
    const data = {
      version: 1,
      records: {
        '20260425-112010-1234': 'not-a-date',
      },
    };
    expect(() => DeleteLogSchema.parse(data)).toThrow();
  });
});

describe('SyncEntitySchema', () => {
  it('parses alive entity', () => {
    const entity = { h: 'abc123', u: '2026-04-25T12:10:00Z' };
    expect(SyncEntitySchema.parse(entity)).toEqual(entity);
  });

  it('parses tombstone entity', () => {
    const entity = { d: true, u: '2026-04-25T14:30:00Z' };
    expect(SyncEntitySchema.parse(entity)).toEqual(entity);
  });

  it('rejects invalid entity', () => {
    expect(() => SyncEntitySchema.parse({ h: 'abc' })).toThrow();
    expect(() => SyncEntitySchema.parse({ d: false, u: '2026-04-25T12:10:00Z' })).toThrow();
  });
});

describe('SyncLedgerSchema', () => {
  it('parses valid sync ledger', () => {
    const data = {
      version: 1,
      last_sync_time: '2026-04-25T13:00:00Z',
      entities: {
        '20260425-112010-1234': { h: 'abc123', u: '2026-04-25T12:10:00Z' },
        '20260425-112010-5678': { d: true, u: '2026-04-25T14:30:00Z' },
      },
      meta_files: {
        'manifest.json': { h: 'hash1', u: '2026-04-20T12:00:00Z' },
      },
    };
    expect(SyncLedgerSchema.parse(data)).toEqual(data);
  });
});

describe('NoteFrontmatterSchema', () => {
  it('parses minimal frontmatter', () => {
    const data = {
      created_at: '2026-04-25T12:10:00Z',
      updated_at: '2026-04-25T12:10:00Z',
    };
    expect(NoteFrontmatterSchema.parse(data)).toEqual(data);
  });

  it('parses full frontmatter', () => {
    const data = {
      created_at: '2026-04-25T12:10:00Z',
      updated_at: '2026-04-25T12:10:00Z',
      _sync_u: '2026-04-25T12:10:00Z',
      tags: ['架构', 'Web'],
      title: 'Test Note',
      aliases: ['别名'],
      type: 'todo',
      deleted: false,
    };
    expect(NoteFrontmatterSchema.parse(data)).toEqual(data);
  });

  it('allows passthrough custom fields', () => {
    const data = {
      created_at: '2026-04-25T12:10:00Z',
      updated_at: '2026-04-25T12:10:00Z',
      custom_field: 'value',
      numeric: 42,
    };
    const result = NoteFrontmatterSchema.parse(data);
    expect((result as Record<string, unknown>).custom_field).toBe('value');
    expect((result as Record<string, unknown>).numeric).toBe(42);
  });

  it('handles string tags', () => {
    const data = {
      created_at: '2026-04-25T12:10:00Z',
      updated_at: '2026-04-25T12:10:00Z',
      tags: 'single-tag',
    };
    expect(NoteFrontmatterSchema.parse(data).tags).toBe('single-tag');
  });

  it('handles array tags', () => {
    const data = {
      created_at: '2026-04-25T12:10:00Z',
      updated_at: '2026-04-25T12:10:00Z',
      tags: ['tag1', 'tag2'],
    };
    expect(NoteFrontmatterSchema.parse(data).tags).toEqual(['tag1', 'tag2']);
  });
});
