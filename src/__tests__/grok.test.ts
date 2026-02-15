import { describe, it, expect } from 'vitest';
import { superGrokPatterns } from '../tools/grok.js';

describe('superGrokPatterns', () => {
  it('returns all patterns when no query provided', () => {
    const result = superGrokPatterns();
    expect(result.success).toBe(true);
    expect(result.count).toBe(89);
    expect(result.patterns.length).toBe(89);
    expect(result.error).toBeNull();
  });

  it('returns all patterns with every entry having pattern_name and regex', () => {
    const result = superGrokPatterns();
    for (const p of result.patterns) {
      expect(p.pattern_name).toBeTruthy();
      expect(p.regex).toBeDefined();
    }
  });

  it('filters by pattern name (case-insensitive)', () => {
    const result = superGrokPatterns('IP');
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
    expect(result.patterns.every(
      p => p.pattern_name.toLowerCase().includes('ip') || p.regex.toLowerCase().includes('ip')
    )).toBe(true);
  });

  it('finds IPV4 and IPV6 patterns', () => {
    const result = superGrokPatterns('IPV');
    expect(result.success).toBe(true);
    const names = result.patterns.map(p => p.pattern_name);
    expect(names).toContain('IPV4');
    expect(names).toContain('IPV6');
  });

  it('filters by regex content', () => {
    const result = superGrokPatterns('apache');
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
  });

  it('returns empty results for non-matching query', () => {
    const result = superGrokPatterns('zzzzzznonexistent');
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    expect(result.patterns).toEqual([]);
  });

  it('includes well-known patterns', () => {
    const result = superGrokPatterns();
    const names = result.patterns.map(p => p.pattern_name);
    expect(names).toContain('SYSLOGBASE');
    expect(names).toContain('COMMONAPACHELOG');
    expect(names).toContain('COMBINEDAPACHELOG');
    expect(names).toContain('TIMESTAMP_ISO8601');
    expect(names).toContain('UUID');
  });
});
