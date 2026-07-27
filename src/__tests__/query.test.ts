import { describe, it, expect } from 'vitest';
import { superQuery } from '../tools/query.js';
import { superDbQuery } from '../tools/db.js';
import { runSuper } from '../lib/super.js';
import { resolveSuperPath } from '../lib/asdf.js';

// Check if super binary is available. Resolved at module load, not in
// beforeAll: skipIf is evaluated during collection, so a value set later is
// always still false — and a thunk is truthy, which skips unconditionally.
const superAvailable = await runSuper(['--version'])
  .then(r => r.exitCode === 0)
  .catch(() => false);

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
  it.skipIf(!superAvailable)('suggests "values" when query uses "yield"', async () => {
    const result = await superQuery({ query: 'yield 1' });
    expect(result.success).toBe(false);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.some(s => s.includes('values'))).toBe(true);
  });

  it.skipIf(!superAvailable)('suggests "unnest" when query uses "over"', async () => {
    const result = await superQuery({ query: 'over this' });
    expect(result.success).toBe(false);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.some(s => s.includes('unnest'))).toBe(true);
  });

  it.skipIf(!superAvailable)('suggests "fn" when query uses "func"', async () => {
    const result = await superQuery({ query: 'func add(a, b): (a + b)' });
    expect(result.success).toBe(false);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.some(s => s.includes('fn'))).toBe(true);
  });

  it.skipIf(!superAvailable)('returns no suggestions for valid queries', async () => {
    const result = await superQuery({ query: 'values 1', data: '' });
    expect(result.success).toBe(true);
    expect(result.suggestions).toBeUndefined();
  });

  it.skipIf(!superAvailable)('does not mistake an identifier containing a keyword for the keyword', async () => {
    const result = await superQuery({ query: 'values nosuchfunc(a)', data: '{a:1}' });
    expect(result.success).toBe(false);
    expect(result.suggestions!.some(s => s.includes('func was renamed'))).toBe(false);
  });

  it.skipIf(!superAvailable)('returns no suggestions for unrelated errors', async () => {
    const result = await superQuery({ query: 'this is not valid syntax at all!!!' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.suggestions).toBeUndefined();
  });

});

// Error shapes verified identical across every installed super (0.1.0 through
// 0.51231), so these match on text without branching on `version`.
describe('superQuery FROM-clause hints', () => {
  it.skipIf(!superAvailable)('names the underlined file when FROM uses a relative path', async () => {
    const result = await superQuery({ query: 'select * from "test-data.json"' });
    expect(result.success).toBe(false);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.some(s => s.includes('test-data.json') && s.includes('absolute'))).toBe(true);
  });

  it.skipIf(!superAvailable)('flags mixing the files parameter with a FROM clause', async () => {
    const result = await superQuery({
      query: 'select * from "test-data.json"',
      files: ['/tmp/claude/test-data.json'],
    });
    expect(result.success).toBe(false);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.some(s => s.includes('files') && s.includes('FROM'))).toBe(true);
  });

  it.skipIf(!superAvailable)('suggests quoting an unquoted path containing a hyphen', async () => {
    const result = await superQuery({ query: 'select * from test-data.json' });
    expect(result.success).toBe(false);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.some(s => s.includes('quote'))).toBe(true);
  });

  it.skipIf(!superAvailable)('reports a missing file from the files parameter without FROM advice', async () => {
    const result = await superQuery({ query: 'values this', files: ['/tmp/claude/nope.json'] });
    expect(result.success).toBe(false);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.some(s => s.includes('/tmp/claude/nope.json'))).toBe(true);
    // The old code gave FROM-clause advice here, which has nothing to do with it
    expect(result.suggestions!.some(s => s.includes('FROM clauses resolve'))).toBe(false);
    // ...and matched /.*/ against the error, so any absolute path tripped the
    // inline-regex hint
    expect(result.suggestions!.some(s => s.includes('Inline regex'))).toBe(false);
  });
});

// Only meaningful when an LSP is configured; the tip is suppressed entirely
// otherwise.
const lspConfigured = !!process.env.SUPERDB_LSP_PATH;

describe('superQuery LSP tip', () => {
  it.skipIf(!superAvailable || !lspConfigured)('fires on an unknown function', async () => {
    const result = await superQuery({ query: 'values nosuchfunc(a)', data: '{a:1}' });
    expect(result.success).toBe(false);
    expect(result.suggestions!.some(s => s.includes('super_docs'))).toBe(true);
  });

  it.skipIf(!superAvailable || !lspConfigured)('fires on an unknown operator', async () => {
    const result = await superQuery({ query: 'nosuchop a', data: '{a:1}' });
    expect(result.success).toBe(false);
    expect(result.suggestions!.some(s => s.includes('super_docs'))).toBe(true);
  });

  it.skipIf(!superAvailable || !lspConfigured)('fires on too many arguments', async () => {
    const result = await superQuery({ query: 'values upper(a,b,c)', data: '{a:1}' });
    expect(result.success).toBe(false);
    expect(result.suggestions!.some(s => s.includes('super_docs'))).toBe(true);
  });

  it.skipIf(!superAvailable || !lspConfigured)('fires on too few arguments', async () => {
    const result = await superQuery({ query: 'values upper()', data: '{a:1}' });
    expect(result.success).toBe(false);
    expect(result.suggestions!.some(s => s.includes('super_docs'))).toBe(true);
  });

  it.skipIf(!superAvailable || !lspConfigured)('stays quiet on errors super_docs cannot help with', async () => {
    const csv = await superQuery({ query: 'values quiet(this.a)', data: '{a:1}', format: 'csv' });
    expect(csv.success).toBe(false);
    expect(csv.suggestions ?? []).toEqual([]);

    const missing = await superQuery({ query: 'values this', files: ['/tmp/claude/nope.json'] });
    expect(missing.success).toBe(false);
    expect(missing.suggestions!.some(s => s.includes('super_docs'))).toBe(false);
  });
});

describe('superQuery inline-regex hint', () => {
  it.skipIf(!superAvailable)('suggests string patterns for a real regex literal', async () => {
    const result = await superQuery({ query: 'where a == /foo/', data: '{a:1}' });
    expect(result.success).toBe(false);
    expect(result.suggestions!.some(s => s.includes('Inline regex'))).toBe(true);
  });

  it.skipIf(!superAvailable)('does not fire on absolute paths in the query', async () => {
    const result = await superQuery({ query: 'select * from "/tmp/claude/nope.json"' });
    expect(result.success).toBe(false);
    expect(result.suggestions!.some(s => s.includes('Inline regex'))).toBe(false);
  });
});

describe('superQuery output formats', () => {
  it.skipIf(!superAvailable)('emits text for "line", not binary bsup', async () => {
    const result = await superQuery({
      query: 'values quiet(this.answer)',
      data: '{answer:5}',
      format: 'line',
    });
    expect(result.success).toBe(true);
    expect(result.raw).toBe('5\n');
  });

  it.skipIf(!superAvailable)('emits distinct output per text format', async () => {
    const q = { query: 'values this', data: '{a:1}' };
    const line = await superQuery({ ...q, format: 'line' });
    const tsv = await superQuery({ ...q, format: 'tsv' });
    const jsup = await superQuery({ ...q, format: 'jsup' });
    for (const r of [line, tsv, jsup]) {
      expect(r.success).toBe(true);
      expect(r.raw).toBeTruthy();
    }
    // The pre-fix bug: every unhandled format fell through to the same bsup bytes
    expect(new Set([line.raw, tsv.raw, jsup.raw]).size).toBe(3);
  });

  it('rejects an unknown format instead of falling through to binary', async () => {
    const result = await superQuery({
      query: 'values quiet(this.answer)',
      data: '{answer:5}',
      format: 'totalgarbage' as never,
    });
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.raw).toBeUndefined();
    expect(result.error).toContain('totalgarbage');
    expect(result.error).toContain('line');
  });

  it('rejects binary formats that cannot survive UTF-8 decoding', async () => {
    for (const format of ['bsup', 'csup', 'db', 'parquet', 'arrows']) {
      const result = await superQuery({
        query: 'values 1',
        data: '',
        format: format as never,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain(format);
    }
  });

  it.skipIf(!superAvailable)('still parses rows for the default json format', async () => {
    const result = await superQuery({ query: 'values quiet(this.answer)', data: '{answer:5}' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual([5]);
    expect(result.rowCount).toBe(1);
  });
});

describe('superDbQuery output formats', () => {
  it('rejects an unknown format before spawning super', async () => {
    const result = await superDbQuery({ query: 'values 1', format: 'totalgarbage' as never });
    expect(result.success).toBe(false);
    expect(result.error).toContain('totalgarbage');
  });

  it('rejects binary formats', async () => {
    const result = await superDbQuery({ query: 'values 1', format: 'bsup' as never });
    expect(result.success).toBe(false);
    expect(result.error).toContain('bsup');
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
