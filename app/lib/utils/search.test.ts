import { describe, it, expect } from 'vitest';
import { filterNotes } from './search';

describe('filterNotes', () => {
  const mockNotes = [
    { content: 'React Router v7 is great' },
    { content: 'Tailwind CSS v4 is fast' },
    { content: 'React and Tailwind together' },
    { content: 'Just some plain text' },
  ];

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
    expect(result[0].content).toBe('React and Tailwind together');
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
