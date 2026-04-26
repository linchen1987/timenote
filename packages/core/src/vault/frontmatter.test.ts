import { describe, expect, it } from 'vitest';
import {
  normalizeAliases,
  normalizeTags,
  normalizeTitle,
  parseNote,
  parseNoteSafe,
  serializeNote,
} from './frontmatter';

describe('parseNote', () => {
  it('parses note with full frontmatter', () => {
    const raw = `---
created_at: "2026-04-25T12:10:00Z"
updated_at: "2026-04-25T12:10:00Z"
tags:
  - 架构
  - Web
title: "深入理解 Local-First 架构"
---

笔记正文内容`;

    const result = parseNote(raw);
    expect(result.frontmatter.created_at).toBe('2026-04-25T12:10:00Z');
    expect(result.frontmatter.updated_at).toBe('2026-04-25T12:10:00Z');
    expect(result.frontmatter.tags).toEqual(['架构', 'Web']);
    expect(result.frontmatter.title).toBe('深入理解 Local-First 架构');
    expect(result.body.trim()).toBe('笔记正文内容');
  });

  it('parses note with minimal frontmatter', () => {
    const raw = `---
created_at: "2026-04-25T12:10:00Z"
updated_at: "2026-04-25T12:10:00Z"
---

Hello world`;

    const result = parseNote(raw);
    expect(result.frontmatter.created_at).toBe('2026-04-25T12:10:00Z');
    expect(result.frontmatter.tags).toBeUndefined();
    expect(result.body.trim()).toBe('Hello world');
  });

  it('parses note with string tags', () => {
    const raw = `---
created_at: "2026-04-25T12:10:00Z"
updated_at: "2026-04-25T12:10:00Z"
tags: single-tag
---

content`;

    const result = parseNote(raw);
    expect(result.frontmatter.tags).toBe('single-tag');
  });

  it('parses note with custom fields (passthrough)', () => {
    const raw = `---
created_at: "2026-04-25T12:10:00Z"
updated_at: "2026-04-25T12:10:00Z"
custom_field: "custom_value"
number_field: 42
---

content`;

    const result = parseNote(raw);
    expect((result.frontmatter as Record<string, unknown>).custom_field).toBe('custom_value');
    expect((result.frontmatter as Record<string, unknown>).number_field).toBe(42);
  });

  it('parses note with deleted flag', () => {
    const raw = `---
created_at: "2026-04-25T12:10:00Z"
updated_at: "2026-04-25T12:10:00Z"
deleted: true
---

content`;

    const result = parseNote(raw);
    expect(result.frontmatter.deleted).toBe(true);
  });

  it('throws for missing required fields', () => {
    const raw = `---
title: "no dates"
---

content`;

    expect(() => parseNote(raw)).toThrow();
  });

  it('throws for invalid date format', () => {
    const raw = `---
created_at: "not-a-date"
updated_at: "2026-04-25T12:10:00Z"
---

content`;

    expect(() => parseNote(raw)).toThrow();
  });

  it('handles empty body', () => {
    const raw = `---
created_at: "2026-04-25T12:10:00Z"
updated_at: "2026-04-25T12:10:00Z"
---
`;

    const result = parseNote(raw);
    expect(result.body).toBe('');
  });
});

describe('parseNoteSafe', () => {
  it('returns parsed result for valid note', () => {
    const raw = `---
created_at: "2026-04-25T12:10:00Z"
updated_at: "2026-04-25T12:10:00Z"
---

content`;

    const result = parseNoteSafe(raw);
    expect(result).not.toBeNull();
    expect(result?.frontmatter.created_at).toBe('2026-04-25T12:10:00Z');
  });

  it('returns null for invalid note', () => {
    const raw = `---
title: "no dates"
---

content`;

    expect(parseNoteSafe(raw)).toBeNull();
  });
});

describe('serializeNote', () => {
  it('serializes note with frontmatter', () => {
    const fm = {
      created_at: '2026-04-25T12:10:00Z',
      updated_at: '2026-04-25T12:10:00Z',
      tags: ['架构', 'Web'],
    };

    const result = serializeNote(fm, '笔记正文');
    expect(result).toContain('created_at');
    expect(result).toContain('updated_at');
    expect(result).toContain('笔记正文');
    expect(result).toContain('架构');
  });

  it('round-trips parse → serialize → parse', () => {
    const original = `---
created_at: "2026-04-25T12:10:00Z"
updated_at: "2026-04-25T13:00:00Z"
tags:
  - tag1
  - tag2
title: "Test Note"
---

Some body content here`;

    const parsed = parseNote(original);
    const serialized = serializeNote(parsed.frontmatter, parsed.body);
    const reparsed = parseNote(serialized);

    expect(reparsed.frontmatter.created_at).toBe(parsed.frontmatter.created_at);
    expect(reparsed.frontmatter.updated_at).toBe(parsed.frontmatter.updated_at);
    expect(reparsed.frontmatter.tags).toEqual(parsed.frontmatter.tags);
    expect(reparsed.frontmatter.title).toBe(parsed.frontmatter.title);
    expect(reparsed.body.trim()).toBe(parsed.body.trim());
  });
});

describe('normalizeTags', () => {
  it('handles undefined', () => {
    expect(normalizeTags()).toEqual([]);
  });

  it('handles string', () => {
    expect(normalizeTags('single')).toEqual(['single']);
  });

  it('handles array', () => {
    expect(normalizeTags(['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('normalizeTitle', () => {
  it('handles undefined', () => {
    expect(normalizeTitle()).toBe('');
  });

  it('handles string', () => {
    expect(normalizeTitle('My Title')).toBe('My Title');
  });

  it('takes first from array', () => {
    expect(normalizeTitle(['First', 'Second'])).toBe('First');
  });
});

describe('normalizeAliases', () => {
  it('collects from title, aliases, alias', () => {
    const result = normalizeAliases(['Title1'], ['Alias1', 'Alias2'], 'Short');
    expect(result).toEqual(['Title1', 'Alias1', 'Alias2', 'Short']);
  });

  it('deduplicates', () => {
    const result = normalizeAliases(['Same'], ['Same'], 'Same');
    expect(result).toEqual(['Same']);
  });

  it('handles all undefined', () => {
    expect(normalizeAliases()).toEqual([]);
  });
});
