import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { superQuery, superSchema } from '../tools/query.js';
import { superDbQuery } from '../tools/db.js';
import { runSuper } from '../lib/super.js';

// Check if super binary is available. Resolved at module load, not in
// beforeAll: skipIf is evaluated during collection, so a value set later is
// always still false — and a thunk is truthy, which skips unconditionally.
const superAvailable = await runSuper(['--version'])
  .then(r => r.exitCode === 0)
  .catch(() => false);

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
    expect(result.suggestions?.some(s => s.includes('func was renamed')) ?? false).toBe(false);
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
      query: 'values this.answer',
      data: '{answer:5}',
      format: 'line',
    });
    expect(result.success).toBe(true);
    expect(result.raw).toBe('5\n');
  });

  it.skipIf(!superAvailable)('emits distinct output per text format', async () => {
    const q = { query: 'values this', data: '{a:1,b:2}' };
    const line = await superQuery({ ...q, format: 'line' });
    const tsv = await superQuery({ ...q, format: 'tsv' });
    const csv = await superQuery({ ...q, format: 'csv' });
    for (const r of [line, tsv, csv]) {
      expect(r.success).toBe(true);
      expect(r.raw).toBeTruthy();
    }
    // The pre-fix bug: every unhandled format fell through to the same bsup bytes
    expect(new Set([line.raw, tsv.raw, csv.raw]).size).toBe(3);
  });

  it('rejects an unknown format instead of falling through to binary', async () => {
    const result = await superQuery({
      query: 'values this.answer',
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
    for (const format of ['bsup', 'db', 'parquet', 'arrows']) {
      const result = await superQuery({
        query: 'values 1',
        data: '',
        format: format as never,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain(format);
    }
  });

  it('rejects formats removed in SuperDB v0.4.0 with an explanation', async () => {
    for (const format of ['table', 'jsup', 'csup']) {
      const result = await superQuery({ query: 'values 1', data: '', format: format as never });
      expect(result.success).toBe(false);
      expect(result.error).toContain(format);
      expect(result.error).toContain('v0.4.0');
    }
  });

  it.skipIf(!superAvailable)('still parses rows for the default json format', async () => {
    const result = await superQuery({ query: 'values this.answer', data: '{answer:5}' });
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

// The debug operator exists in SuperDB v0.3.0 and later.
describe('superQuery debug output', () => {
  it.skipIf(!superAvailable)('captures debug operator stderr in result', async () => {
    const result = await superQuery({
      query: 'values "hello, world" | debug {debug:this} | where false',
    });
    expect(result.success).toBe(true);
    expect(result.debug).toBeDefined();
    expect(result.debug).toContain('debug');
    expect(result.debug).toContain('hello, world');
  });

  it.skipIf(!superAvailable)('debug field is absent when no debug output', async () => {
    const result = await superQuery({
      query: 'values 1,2,3',
    });
    expect(result.success).toBe(true);
    expect(result.debug).toBeUndefined();
  });
});

// SuperDB v0.4.0 removed or renamed several functions and syntax forms. These
// hints map the resulting errors to the replacement.
describe('superQuery v0.4.0 migration hints', () => {
  const cases: Array<[string, string, string]> = [
    ['values has(a)', 'is_ok(', 'has()'],
    ['values missing(a)', 'is_ok(', 'missing()'],
    ['values quiet(a)', 'ok(', 'quiet()'],
    ['values fields(this)', 'paths(', 'fields()'],
    ['values max(a, 2)', 'greatest(', 'max('],
    ['values min(a, 2)', 'least(', 'min('],
    ['values unblend(this)', 'defuse(', 'unblend()'],
    ['blend', 'fuse', 'blend'],
    ['values |[1,2]|', 'set[', '|[...]|'],
    ['values |{"a":1}|', 'map{', '|{...}|'],
  ];

  for (const [query, replacement, old] of cases) {
    it.skipIf(!superAvailable)(`suggests ${replacement.replace(/[([{]$/, '')} for ${old}`, async () => {
      const result = await superQuery({ query, data: '{a:1}' });
      expect(result.success).toBe(false);
      expect(result.suggestions, result.error ?? '').toBeDefined();
      expect(result.suggestions!.some(s => s.includes(replacement) && s.includes('v0.4.0'))).toBe(true);
    });
  }

  it.skipIf(!superAvailable)('does not return null hints for names on Object.prototype', async () => {
    for (const query of ['values toString(a)', 'values valueOf(a)', 'constructor']) {
      const result = await superQuery({ query, data: '{a:1}' });
      expect(result.success).toBe(false);
      // The prototype lookup returned the function itself, which JSON
      // serializes as null.
      expect((result.suggestions ?? []).every(s => typeof s === 'string'), query).toBe(true);
    }
  });

  it.skipIf(!superAvailable)('hints every removed function, not just the first error', async () => {
    const result = await superQuery({ query: 'values has(a), quiet(a)', data: '{a:1}' });
    expect(result.suggestions!.some(s => s.includes('is_ok('))).toBe(true);
    expect(result.suggestions!.some(s => s.includes('ok(x)'))).toBe(true);

    const afterFileError = await superQuery({ query: 'from "/nonexistent.json" | values has(a)' });
    expect(afterFileError.suggestions!.some(s => s.includes('is_ok('))).toBe(true);
  });

  it.skipIf(!superAvailable)('does not fire syntax hints on text inside strings and regexes', async () => {
    const cases: Array<[string, string]> = [
      ['where grep(/error|[Ww]arn/, s) | values (', 'set['],
      ['where s=="a|{b" | values (', 'map{'],
      ['where s=="missing(x)" | values (', 'missing(x)'],
    ];
    for (const [query, hint] of cases) {
      const result = await superQuery({ query, data: '{s:"x"}' });
      expect(result.success, query).toBe(false);
      expect(result.suggestions?.some(s => s.includes(hint)) ?? false, query).toBe(false);
    }
  });

  it.skipIf(!superAvailable)('does not hint from data that merely looks like a super error', async () => {
    const result = await superQuery({
      format: 'line',
      query: 'values msg',
      data: '{msg:"no such function at line 1, column 8:\\nvalues has(a)\\n       ~~~~~~"}\n{msg:"no such user operator: \\"blend\\""}',
    });
    expect(result.success).toBe(true);
    expect(result.suggestions).toBeUndefined();
  });

  it.skipIf(!superAvailable)('suggests inputFormat when a file has no recognized extension', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'superdb-mcp-q-'));
    const file = join(dir, 'noext');
    writeFileSync(file, '{"a":1}\n');
    try {
      const result = await superQuery({ query: 'values a', files: [file] });
      expect(result.success).toBe(false);
      expect(result.suggestions!.some(s => s.includes('inputFormat'))).toBe(true);

      const fixed = await superQuery({ query: 'values a', files: [file], inputFormat: 'json' });
      expect(fixed.data).toEqual([1]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!superAvailable)('suggests inputFormat when a FROM path has no recognized extension', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'superdb-mcp-q-'));
    const file = join(dir, 'noext');
    writeFileSync(file, '{"a":1}\n');
    try {
      const result = await superQuery({ query: `from "${file}" | values a` });
      expect(result.success).toBe(false);
      expect(result.suggestions!.some(s => s.includes('inputFormat'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!superAvailable)('flags ::time, which now means time-of-day (use ::timestamp)', async () => {
    const result = await superQuery({ query: "values '2025-01-01T00:00:00Z'::time" });
    expect(result.suggestions!.some(s => s.includes('::timestamp'))).toBe(true);
  });
});

describe('superQuery static type checking', () => {
  let dir: string;
  let file: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'superdb-mcp-static-'));
    file = join(dir, 'data.json');
    writeFileSync(file, '{"id":1,"v":"a"}\n{"id":2,"v":"b"}\n');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it.skipIf(!superAvailable)('suggests static for SQL on dynamic (JSON) input', async () => {
    const result = await superQuery({ query: `select * from "${file}"` });
    expect(result.success).toBe(false);
    expect(result.suggestions!.some(s => s.includes('static'))).toBe(true);
  });

  it.skipIf(!superAvailable)('runs SQL on JSON input with static: true', async () => {
    const result = await superQuery({ query: `select * from "${file}" order by id`, static: true });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: 1, v: 'a' }, { id: 2, v: 'b' }]);
  });
});

describe('superSchema', () => {
  it.skipIf(!superAvailable)('reads a file with no recognized extension given inputFormat', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'superdb-mcp-schema-'));
    const file = join(dir, 'noext');
    writeFileSync(file, '{"a":1}\n{"a":2}\n');
    try {
      const result = await superSchema(file, undefined, 'json');
      expect(result.error).toBeNull();
      expect(result.totalRecords).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
