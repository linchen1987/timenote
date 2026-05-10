import { describe, expect, it } from 'vitest';
import { computeContentHash } from './hash';

describe('computeContentHash', () => {
  it('returns the same hash for identical content', async () => {
    const content = '---\ntitle: Hello\n---\nWorld';
    const a = await computeContentHash(content);
    const b = await computeContentHash(content);
    expect(a).toBe(b);
  });

  it('returns different hashes for different content', async () => {
    const a = await computeContentHash('note A');
    const b = await computeContentHash('note B');
    expect(a).not.toBe(b);
  });

  it('returns a 64-char lowercase hex string (SHA-256)', async () => {
    const hash = await computeContentHash('test');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic across multiple calls', async () => {
    const content = '稳定的中文内容 🎉';
    const hashes = await Promise.all(Array.from({ length: 10 }, () => computeContentHash(content)));
    expect(new Set(hashes).size).toBe(1);
  });

  it('treats empty string as valid input', async () => {
    const hash = await computeContentHash('');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is sensitive to whitespace differences', async () => {
    const a = await computeContentHash('hello world');
    const b = await computeContentHash('hello  world');
    const c = await computeContentHash('hello world\n');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it('produces known SHA-256 value for a fixed input', async () => {
    const hash = await computeContentHash('');
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
