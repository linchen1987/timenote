import { describe, expect, it } from 'vitest';
import {
  filenameFromNoteId,
  generateNoteId,
  generateProjectId,
  isValidNoteFilename,
  isValidNoteId,
  isValidVolumeName,
  noteIdFromFilename,
  noteIdFromUrl,
  noteIdToUrl,
  notePath,
  volumeNameFromDate,
  volumeNameFromNoteId,
} from './note-id';

describe('generateNoteId', () => {
  it('generates valid note ID with current time', () => {
    const id = generateNoteId();
    expect(isValidNoteId(id)).toBe(true);
  });

  it('generates note ID from specific date', () => {
    const date = new Date('2026-04-25T12:10:00.456Z');
    const id = generateNoteId(date);
    expect(id).toMatch(/^20260425-121000-456\d$/);
  });

  it('generates unique IDs for same millisecond', () => {
    const date = new Date('2026-04-25T12:10:00.000Z');
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateNoteId(date));
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it('uses UTC components', () => {
    const date = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0));
    const id = generateNoteId(date);
    expect(id).toMatch(/^20250101-000000-000\d$/);
  });
});

describe('isValidNoteId', () => {
  it('accepts valid note IDs', () => {
    expect(isValidNoteId('20260425-121000-1234')).toBe(true);
    expect(isValidNoteId('20250101-000000-0000')).toBe(true);
  });

  it('rejects invalid note IDs', () => {
    expect(isValidNoteId('')).toBe(false);
    expect(isValidNoteId('abc')).toBe(false);
    expect(isValidNoteId('20260425-121000-123')).toBe(false);
    expect(isValidNoteId('20260425-121000-12345')).toBe(false);
    expect(isValidNoteId('2026-04-25-121000-1234')).toBe(false);
  });
});

describe('noteIdFromFilename', () => {
  it('extracts note ID from .md filename', () => {
    expect(noteIdFromFilename('20260425-121000-1234.md')).toBe('20260425-121000-1234');
  });

  it('extracts note ID from other extensions', () => {
    expect(noteIdFromFilename('20260425-121000-1234.png')).toBe('20260425-121000-1234');
  });

  it('returns null for invalid filename', () => {
    expect(noteIdFromFilename('readme.md')).toBeNull();
    expect(noteIdFromFilename('notes.txt')).toBeNull();
    expect(noteIdFromFilename('20260425.md')).toBeNull();
  });
});

describe('filenameFromNoteId', () => {
  it('creates .md filename by default', () => {
    expect(filenameFromNoteId('20260425-121000-1234')).toBe('20260425-121000-1234.md');
  });

  it('creates filename with custom extension', () => {
    expect(filenameFromNoteId('20260425-121000-1234', 'png')).toBe('20260425-121000-1234.png');
  });
});

describe('volumeNameFromDate', () => {
  it('extracts YYYY-MM from ISO date', () => {
    expect(volumeNameFromDate('2026-04-25T12:10:00Z')).toBe('2026-04');
    expect(volumeNameFromDate('2025-12-01T00:00:00.000Z')).toBe('2025-12');
  });

  it('throws for invalid ISO date', () => {
    expect(() => volumeNameFromDate('invalid')).toThrow();
    expect(() => volumeNameFromDate('')).toThrow();
  });
});

describe('volumeNameFromNoteId', () => {
  it('extracts YYYY-MM from note ID', () => {
    expect(volumeNameFromNoteId('20260425-121000-1234')).toBe('2026-04');
    expect(volumeNameFromNoteId('20250101-000000-0000')).toBe('2025-01');
  });
});

describe('isValidNoteFilename', () => {
  it('accepts valid note filenames', () => {
    expect(isValidNoteFilename('20260425-121000-1234.md')).toBe(true);
    expect(isValidNoteFilename('20260425-121000-1234.png')).toBe(true);
    expect(isValidNoteFilename('20260425-121000-1234.jpg')).toBe(true);
  });

  it('rejects invalid filenames', () => {
    expect(isValidNoteFilename('readme.md')).toBe(false);
    expect(isValidNoteFilename('20260425-121000-1234')).toBe(false);
    expect(isValidNoteFilename('.md')).toBe(false);
  });
});

describe('isValidVolumeName', () => {
  it('accepts valid volume names', () => {
    expect(isValidVolumeName('2026-04')).toBe(true);
    expect(isValidVolumeName('2025-01')).toBe(true);
    expect(isValidVolumeName('2025-12')).toBe(true);
  });

  it('rejects invalid volume names', () => {
    expect(isValidVolumeName('')).toBe(false);
    expect(isValidVolumeName('2026-4')).toBe(false);
    expect(isValidVolumeName('26-04')).toBe(false);
    expect(isValidVolumeName('2026/04')).toBe(false);
  });
});

describe('generateProjectId', () => {
  it('generates alphanumeric ID without - or _', () => {
    const id = generateProjectId();
    expect(id).toMatch(/^[A-Za-z0-9]{11}$/);
    expect(id).not.toContain('-');
    expect(id).not.toContain('_');
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateProjectId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('notePath', () => {
  it('constructs full note path', () => {
    expect(notePath('20260425-121000-1234')).toBe('2026-04/20260425-121000-1234.md');
    expect(notePath('20260425-121000-1234', 'png')).toBe('2026-04/20260425-121000-1234.png');
  });
});

describe('noteIdToUrl', () => {
  it('removes all dashes', () => {
    expect(noteIdToUrl('20260425-121000-1234')).toBe('202604251210001234');
  });

  it('returns same string if no dashes', () => {
    expect(noteIdToUrl('202604251210001234')).toBe('202604251210001234');
  });
});

describe('noteIdFromUrl', () => {
  it('converts no-dash URL to internal format', () => {
    expect(noteIdFromUrl('202604251210001234')).toBe('20260425-121000-1234');
  });

  it('passes through dash format unchanged', () => {
    expect(noteIdFromUrl('20260425-121000-1234')).toBe('20260425-121000-1234');
  });
});
