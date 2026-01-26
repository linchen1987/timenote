import { describe, expect, it } from 'vitest';
import { filterNotes } from '~/lib/utils/search';

describe('filterNotes', () => {
  const mockNotes = [
    { id: '1', content: 'React Router v7 is great #react #router' },
    { id: '2', content: 'Tailwind CSS v4 is fast #tailwind #css' },
    { id: '3', content: 'React and Tailwind together #react #tailwind' },
    { id: '4', content: 'Just some plain text' },
  ];

  const mockTagsMap = {
    '1': ['react', 'router'],
    '2': ['tailwind', 'css'],
    '3': ['react', 'tailwind'],
    '4': [],
  };

  it('should return all notes when query is empty', () => {
    expect(filterNotes(mockNotes, '')).toEqual(mockNotes);
    expect(filterNotes(mockNotes, '   ')).toEqual(mockNotes);
  });

  it('should filter by a single keyword', () => {
    const result = filterNotes(mockNotes, 'react');
    expect(result).toHaveLength(2);
    expect(result[0].content).toContain('React');
    expect(result[1].content).toContain('React');
  });

  it('should filter by multiple keywords (AND logic)', () => {
    const result = filterNotes(mockNotes, 'react tailwind');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('React and Tailwind together #react #tailwind');
  });

  it('should filter by tags', () => {
    const result = filterNotes(mockNotes, '#react', mockTagsMap);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toContain('1');
    expect(result.map((r) => r.id)).toContain('3');
  });

  it('should filter by mixed text and tags', () => {
    const result = filterNotes(mockNotes, 'router #react', mockTagsMap);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should be case-insensitive', () => {
    const result = filterNotes(mockNotes, 'REACT');
    expect(result).toHaveLength(2);
  });

  it('should handle multiple spaces between terms', () => {
    const result = filterNotes(mockNotes, 'react    tailwind');
    expect(result).toHaveLength(1);
  });

  it('should return empty array when no matches found', () => {
    const result = filterNotes(mockNotes, 'vue');
    expect(result).toHaveLength(0);
  });
});
