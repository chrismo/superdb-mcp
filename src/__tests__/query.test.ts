import { describe, it, expect, beforeAll } from 'vitest';
import { superQuery } from '../tools/query.js';
import { runSuper } from '../lib/super.js';
import { resolveSuperPath } from '../lib/asdf.js';

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

// Check if 0.3.0 is installed (needed for debug operator tests)
function isVersionInstalled(version: string): boolean {
  try {
    resolveSuperPath(version);
    return true;
  } catch {
    return false;
  }
}
const v030Installed = isVersionInstalled('0.3.0');

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

  it.skipIf(() => !superAvailable)('suggests absolute path when FROM uses relative name but files has absolute path', async () => {
    const absPath = '/tmp/claude/test-data.json';
    const result = await superQuery({
      query: 'select * from test-data.json',
      files: [absPath],
    });
    expect(result.success).toBe(false);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.some(s => s.includes(absPath) && s.includes('FROM'))).toBe(true);
  });
});

describe('superQuery debug output', () => {
  it.skipIf(!v030Installed)('captures debug operator stderr in result', async () => {
    const result = await superQuery({
      query: 'values "hello, world" | debug {debug:this} | where false',
      version: '0.3.0',
    });
    expect(result.success).toBe(true);
    expect(result.debug).toBeDefined();
    expect(result.debug).toContain('debug');
    expect(result.debug).toContain('hello, world');
  });

  it.skipIf(!v030Installed)('debug field is absent when no debug output', async () => {
    const result = await superQuery({
      query: 'values 1,2,3',
      version: '0.3.0',
    });
    expect(result.success).toBe(true);
    expect(result.debug).toBeUndefined();
  });
});
