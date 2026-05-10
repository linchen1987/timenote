import { describe, expect, it } from 'vitest';
import { generateProjectId } from './project-id';

describe('generateProjectId', () => {
  it('generates alphanumeric ID without - or _', () => {
    const id = generateProjectId();
    expect(id).toMatch(/^v[A-Za-z0-9]{11}$/);
    expect(id.length).toBe(12);
    expect(id[0]).toBe('v');
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
