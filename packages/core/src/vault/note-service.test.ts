import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from './note-service';

describe('parseSearchQuery', () => {
  it('parses tag-only query', () => {
    const result = parseSearchQuery('#架构 #Web');
    expect(result.tags).toEqual(['架构', 'Web']);
    expect(result.textTerms).toEqual([]);
  });

  it('parses text-only query', () => {
    const result = parseSearchQuery('local-first architecture');
    expect(result.tags).toEqual([]);
    expect(result.textTerms).toEqual(['local-first', 'architecture']);
  });

  it('parses mixed query', () => {
    const result = parseSearchQuery('#架构 local-first #Web storage');
    expect(result.tags).toEqual(['架构', 'Web']);
    expect(result.textTerms).toEqual(['local-first', 'storage']);
  });

  it('handles empty query', () => {
    const result = parseSearchQuery('');
    expect(result.tags).toEqual([]);
    expect(result.textTerms).toEqual([]);
  });

  it('handles whitespace-only query', () => {
    const result = parseSearchQuery('   ');
    expect(result.tags).toEqual([]);
    expect(result.textTerms).toEqual([]);
  });

  it('ignores lone hash without content', () => {
    const result = parseSearchQuery('# hello');
    expect(result.tags).toEqual([]);
    expect(result.textTerms).toEqual(['hello']);
  });

  it('handles single tag', () => {
    const result = parseSearchQuery('#tag1');
    expect(result.tags).toEqual(['tag1']);
    expect(result.textTerms).toEqual([]);
  });

  it('handles single text term', () => {
    const result = parseSearchQuery('search-term');
    expect(result.tags).toEqual([]);
    expect(result.textTerms).toEqual(['search-term']);
  });
});
