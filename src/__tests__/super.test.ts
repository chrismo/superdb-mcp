import { describe, it, expect } from 'vitest';
import { parseNDJSON, tryParseJSON, runSuper } from '../lib/super.js';

const superAvailable = await runSuper(['--version'])
  .then(r => r.exitCode === 0)
  .catch(() => false);

describe('parseNDJSON', () => {
  it('parses single-line JSON', () => {
    const result = parseNDJSON('{"a":1}\n');
    expect(result).toEqual([{ a: 1 }]);
  });

  it('parses multiple lines', () => {
    const result = parseNDJSON('{"a":1}\n{"b":2}\n{"c":3}\n');
    expect(result).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it('handles trailing newlines and blank lines', () => {
    const result = parseNDJSON('{"a":1}\n\n{"b":2}\n\n');
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('parses arrays in NDJSON', () => {
    const result = parseNDJSON('[1,2]\n[3,4]\n');
    expect(result).toEqual([[1, 2], [3, 4]]);
  });

  it('parses primitive values', () => {
    const result = parseNDJSON('42\n"hello"\ntrue\nnull\n');
    expect(result).toEqual([42, 'hello', true, null]);
  });

  it('throws on invalid JSON lines', () => {
    expect(() => parseNDJSON('not json\n')).toThrow();
  });

  it('returns empty array for empty input', () => {
    const result = parseNDJSON('');
    expect(result).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    const result = parseNDJSON('   \n  \n  ');
    expect(result).toEqual([]);
  });
});

describe('tryParseJSON', () => {
  it('parses valid JSON object', () => {
    expect(tryParseJSON('{"key":"value"}')).toEqual({ key: 'value' });
  });

  it('parses valid JSON array', () => {
    expect(tryParseJSON('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('parses JSON primitives', () => {
    expect(tryParseJSON('42')).toBe(42);
    expect(tryParseJSON('"hello"')).toBe('hello');
    expect(tryParseJSON('true')).toBe(true);
    expect(tryParseJSON('null')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(tryParseJSON('not json')).toBeNull();
    expect(tryParseJSON('{broken')).toBeNull();
    expect(tryParseJSON('')).toBeNull();
  });
});

describe('runSuper', () => {
  // super exits on the parse error without reading stdin, so writing a large
  // input hits EPIPE. Without a stdin error listener that crashed the server.
  it.skipIf(!superAvailable)('survives super exiting before it reads all of stdin', async () => {
    const big = '{a:1}\n'.repeat(4_000_000);
    const result = await runSuper(['-c', 'values (', '-'], big);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('parse error');
  });
});
