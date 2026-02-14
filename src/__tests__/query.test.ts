import { describe, it, expect, beforeAll } from 'vitest';
import { superQuery } from '../tools/query.js';
import { runSuper } from '../lib/super.js';

// Check if super binary is available
let superAvailable = false;

beforeAll(async () => {
  try {
    const result = await runSuper(['--version']);
    superAvailable = result.exitCode === 0;
  } catch {
    superAvailable = false;
  }
});

describe('superQuery migration hints', () => {
  it.skipIf(() => !superAvailable)('suggests "values" when query uses "yield"', async () => {
    const result = await superQuery({ query: 'yield 1' });
    expect(result.success).toBe(false);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.some(s => s.includes('values'))).toBe(true);
  });

  it.skipIf(() => !superAvailable)('suggests "unnest" when query uses "over"', async () => {
    const result = await superQuery({ query: 'over this' });
    expect(result.success).toBe(false);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.some(s => s.includes('unnest'))).toBe(true);
  });

  it.skipIf(() => !superAvailable)('suggests "fn" when query uses "func"', async () => {
    const result = await superQuery({ query: 'func add(a, b): (a + b)' });
    expect(result.success).toBe(false);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.some(s => s.includes('fn'))).toBe(true);
  });

  it.skipIf(() => !superAvailable)('returns no suggestions for valid queries', async () => {
    const result = await superQuery({ query: 'values 1', data: '' });
    expect(result.success).toBe(true);
    expect(result.suggestions).toBeUndefined();
  });

  it.skipIf(() => !superAvailable)('returns no suggestions for unrelated errors', async () => {
    const result = await superQuery({ query: 'this is not valid syntax at all!!!' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.suggestions).toBeUndefined();
  });
});
