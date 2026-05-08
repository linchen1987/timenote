import { describe, expect, it } from 'vitest';
import { extractTagsFromBody, parseSearchQuery } from './search-query';

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

describe('extractTagsFromBody', () => {
  it('extracts hashtags from body', () => {
    const tags = extractTagsFromBody('This is #architecture and #Web');
    expect(tags).toEqual(['architecture', 'Web']);
  });

  it('deduplicates tags', () => {
    const tags = extractTagsFromBody('#test and #test again');
    expect(tags).toEqual(['test']);
  });

  it('extracts Chinese tags', () => {
    const tags = extractTagsFromBody('这是#架构设计的笔记');
    expect(tags).toEqual(['架构设计的笔记']);
  });

  it('returns empty array for no tags', () => {
    const tags = extractTagsFromBody('no tags here');
    expect(tags).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    const tags = extractTagsFromBody('');
    expect(tags).toEqual([]);
  });
});
