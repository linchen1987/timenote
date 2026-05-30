import { describe, expect, it } from 'vitest';
import { SimpleSearchProvider } from './search-provider';

describe('SimpleSearchProvider', () => {
  it('adds and searches content', () => {
    const provider = new SimpleSearchProvider();
    provider.add('1', 'Hello world');
    provider.add('2', 'Hello TypeScript');
    provider.add('3', 'Goodbye world');

    const results = provider.search(['hello']);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toContain('1');
    expect(results.map((r) => r.id)).toContain('2');
  });

  it('searches case-insensitively', () => {
    const provider = new SimpleSearchProvider();
    provider.add('1', 'Hello World');

    const results = provider.search(['HELLO']);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('AND logic: all terms must match', () => {
    const provider = new SimpleSearchProvider();
    provider.add('1', 'Hello world');
    provider.add('2', 'Hello TypeScript');

    const results = provider.search(['hello', 'world']);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('returns empty for no matches', () => {
    const provider = new SimpleSearchProvider();
    provider.add('1', 'Hello world');

    expect(provider.search(['xyz'])).toHaveLength(0);
  });

  it('scores by occurrence count', () => {
    const provider = new SimpleSearchProvider();
    provider.add('1', 'test test test');
    provider.add('2', 'test');

    const results = provider.search(['test']);
    expect(results[0].id).toBe('1');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('update replaces content', () => {
    const provider = new SimpleSearchProvider();
    provider.add('1', 'Hello world');
    provider.update('1', 'Goodbye world');

    expect(provider.search(['hello'])).toHaveLength(0);
    expect(provider.search(['goodbye'])).toHaveLength(1);
  });

  it('remove deletes entry', () => {
    const provider = new SimpleSearchProvider();
    provider.add('1', 'Hello world');
    provider.remove('1');

    expect(provider.search(['hello'])).toHaveLength(0);
  });

  it('clear empties all entries', () => {
    const provider = new SimpleSearchProvider();
    provider.add('1', 'Hello');
    provider.add('2', 'World');
    provider.clear();

    expect(provider.size()).toBe(0);
  });

  it('size returns entry count', () => {
    const provider = new SimpleSearchProvider();
    expect(provider.size()).toBe(0);
    provider.add('1', 'Hello');
    expect(provider.size()).toBe(1);
    provider.add('2', 'World');
    expect(provider.size()).toBe(2);
  });

  it('handles Chinese content', () => {
    const provider = new SimpleSearchProvider();
    provider.add('1', '深入理解 Local-First 架构');
    provider.add('2', 'Web 开发入门');

    const results = provider.search(['架构']);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });
});
