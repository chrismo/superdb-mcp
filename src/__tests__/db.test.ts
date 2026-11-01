import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runSuper } from '../lib/super.js';
import {
  superDbList,
  superDbQuery,
  superDbLoad,
  superDbCreateTable,
  dbToolArgs,
  dbErrorSuggestions,
} from '../tools/db.js';

// These run the real `super db` commands, so they need SuperDB v0.4.0+
// (tables, `-attach`). Resolved at module load: skipIf is evaluated during
// collection.
const superVersion = await runSuper(['--version'])
  .then(r => (r.exitCode === 0 ? r.stdout.trim() : ''))
  .catch(() => '');
const m = superVersion.match(/v(\d+)\.(\d+)\.(\d+)/);
const hasTables = !!m && (Number(m[1]) > 0 || Number(m[2]) >= 4);

describe.skipIf(!hasTables)('super db tools (SuperDB v0.4.0+)', () => {
  let dir: string;
  let database: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'superdb-mcp-db-'));
    database = join(dir, 'db');
    const init = await runSuper(['db', 'init', '-q', database]);
    expect(init.exitCode, init.stderr).toBe(0);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('lists no tables in a new database', async () => {
    const result = await superDbList({ database });
    expect(result.error).toBeNull();
    expect(result.success).toBe(true);
    expect(result.tables).toEqual([]);
  });

  it('creates a table', async () => {
    const result = await superDbCreateTable({ name: 'events', database });
    expect(result.error).toBeNull();
    expect(result.success).toBe(true);
    expect(result.message).toContain('events');
  });

  it('creates a table with a sort key and a type', async () => {
    const result = await superDbCreateTable({
      name: 'typed',
      orderBy: 'id',
      type: '{id:int64,name:string}',
      database,
    });
    expect(result.error).toBeNull();
    expect(result.success).toBe(true);
  });

  it('lists tables by name with their sort keys', async () => {
    const result = await superDbList({ database });
    expect(result.success).toBe(true);
    const names = result.tables.map(t => t.name).sort();
    expect(names).toEqual(['events', 'typed']);
    const typed = result.tables.find(t => t.name === 'typed')!;
    expect(typed.sortKeys).toEqual(['id:asc']);
  });

  it('loads inline data into a table', async () => {
    const result = await superDbLoad({
      table: 'events',
      data: '{id:1,msg:"hello"}\n{id:2,msg:"world"}',
      database,
    });
    expect(result.error).toBeNull();
    expect(result.success).toBe(true);
  });

  it('loads files into a table', async () => {
    const file = join(dir, 'more.sup');
    writeFileSync(file, '{id:3,msg:"again"}\n');
    const result = await superDbLoad({ table: 'events', files: [file], database });
    expect(result.error).toBeNull();
    expect(result.success).toBe(true);
  });

  it('queries a table with FROM in the query', async () => {
    const result = await superDbQuery({
      query: 'from events | sort id | values id',
      database,
    });
    expect(result.error).toBeNull();
    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.rowCount).toBe(3);
  });

  it('prepends FROM when the table parameter is given', async () => {
    const result = await superDbQuery({
      query: 'where id == 2 | values msg',
      table: 'events',
      database,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual(['world']);
  });

  it('runs SQL statements against the database', async () => {
    const result = await superDbQuery({
      query: 'CREATE TABLE people (id int64 NOT NULL, name string); INSERT INTO people VALUES (1, \'ada\')',
      database,
    });
    expect(result.error).toBeNull();
    expect(result.success).toBe(true);
    const kinds = (result.data as Array<{ kind: string; error: unknown }>).map(r => [r.kind, r.error]);
    expect(kinds).toEqual([['create_table', null], ['insert', null]]);

    const people = await superDbQuery({ query: 'select name from people', database });
    expect(people.data).toEqual([{ name: 'ada' }]);
  });

  it('reports a load that a typed table rejects', async () => {
    const result = await superDbLoad({ table: 'typed', data: '{id:"oops",name:"x"}', database });
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot be cast');
  });

  it('reports an error for a missing table', async () => {
    const result = await superDbQuery({ query: 'from nosuchtable', database });
    expect(result.success).toBe(false);
    expect(result.error).toContain('nosuchtable: table not found');
  });

  it('quotes a table name that is not a plain identifier', async () => {
    expect((await superDbCreateTable({ name: 'my-table', database })).error).toBeNull();
    expect((await superDbLoad({ table: 'my-table', data: '{id:7}', database })).error).toBeNull();
    const result = await superDbQuery({ query: 'values id', table: 'my-table', database });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([7]);
  });

  it('keeps a branch outside the quoted table name', async () => {
    const result = await superDbQuery({ query: 'count()', table: 'my-table@main', database });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([1]);
  });

  it('prepends FROM when "from" appears only in a string or field name', async () => {
    await superDbCreateTable({ name: 'notes', database });
    await superDbLoad({ table: 'notes', data: '{id:9,msg:"hello from x"}', database });
    const inString = await superDbQuery({ query: 'where msg=="hello from x" | values id', table: 'notes', database });
    expect(inString.error).toBeNull();
    expect(inString.data).toEqual([9]);

    const asField = await superDbQuery({ query: 'cut from:=msg', table: 'notes', database });
    expect(asField.error).toBeNull();
    expect(asField.data).toEqual([{ from: 'hello from x' }]);
  });

  it('prepends FROM when the only FROM is inside a subquery', async () => {
    const result = await superDbQuery({
      query: 'values {id, n:(from "my-table" | count())}',
      table: 'notes',
      database,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: 9, n: 1 }]);
  });

  it('reads the whole table when the query is empty', async () => {
    const result = await superDbQuery({ query: '', table: 'my-table', database });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: 7 }]);
  });

  it('keeps the status records of a partly failed SQL batch', async () => {
    const result = await superDbQuery({
      query: 'CREATE TABLE q1 (id int64); INSERT INTO nosuch VALUES (1)',
      database,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('nosuch: table not found');
    const records = result.data as Array<{ kind: string }>;
    expect(records[0]).toMatchObject({ kind: 'create_table', info: { table: 'q1', created: true }, error: null });
    expect(records[1]).toMatchObject({ kind: 'insert', error: 'nosuch: table not found' });
  });

  it('honors non-json formats', async () => {
    const result = await superDbQuery({
      query: 'from events | sort id | values id',
      database,
      format: 'line',
    });
    expect(result.success).toBe(true);
    expect(result.raw).toBe('1\n2\n3\n');
  });
});

describe.skipIf(!hasTables)('super db hints', () => {
  const calls: Array<[string, () => Promise<{ success: boolean; error: string | null; suggestions?: string[] }>]> = [
    ['super_db_query', () => superDbQuery({ query: 'from x' })],
    ['super_db_list', () => superDbList({})],
    ['super_db_load', () => superDbLoad({ table: 'x', data: '{a:1}' })],
    ['super_db_create_table', () => superDbCreateTable({ name: 'x' })],
  ];
  for (const [tool, call] of calls) {
    it(`${tool} points to the database parameter when no database is attached`, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'superdb-mcp-noattach-'));
      const prevHome = process.env.HOME;
      process.env.HOME = dir; // empty config dir: nothing attached
      try {
        const result = await call();
        expect(result.success).toBe(false);
        expect(result.error).toContain('no database attached');
        expect(result.suggestions!.some(s => s.includes('database'))).toBe(true);
      } finally {
        process.env.HOME = prevHome;
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});

// Missing or malformed arguments are rejected before super runs; these never
// spawn it, so they run without a binary.
describe('super db argument validation', () => {
  it('rejects create without a name instead of creating "undefined"', async () => {
    const result = await superDbCreateTable({ name: undefined as unknown as string, database: '/nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('name');
  });

  it('rejects a table name that super would read as a flag', async () => {
    const result = await superDbCreateTable({ name: '-q', database: '/nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('-q');
  });

  it('rejects load without a table', async () => {
    const result = await superDbLoad({ table: undefined as unknown as string, data: '{a:1}', database: '/nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('table');
  });

  it('rejects load with both files and data', async () => {
    const result = await superDbLoad({ table: 't', files: ['/x.sup'], data: '{a:1}', database: '/nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('files or data');
  });

  it('rejects a query with neither query nor table', async () => {
    const result = await superDbQuery({ query: undefined as unknown as string, database: '/nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('query');
  });
});

describe('dbToolArgs', () => {
  it('reads the current parameter names', () => {
    expect(dbToolArgs({ table: 't', database: '/db', name: 'n' })).toEqual({ table: 't', database: '/db', name: 'n' });
  });

  it('accepts the pre-v0.4.0 names pool and lake', () => {
    expect(dbToolArgs({ pool: 'p', lake: '/lake' })).toEqual({ table: 'p', database: '/lake', name: 'p' });
  });

  it('prefers the current names when both are given', () => {
    expect(dbToolArgs({ table: 't', pool: 'p', database: '/db', lake: '/lake' })).toMatchObject({ table: 't', database: '/db' });
  });

  it('accepts table as the name for create', () => {
    expect(dbToolArgs({ table: 't' }).name).toBe('t');
  });

  it('handles missing arguments', () => {
    expect(dbToolArgs(undefined)).toEqual({ table: undefined, database: undefined, name: undefined });
  });
});

describe('dbErrorSuggestions', () => {
  it('explains -attach on a super older than v0.4.0', () => {
    const hints = dbErrorSuggestions('flag provided but not defined: -attach');
    expect(hints.some(s => s.includes('v0.4.0'))).toBe(true);
  });

  it('is empty for unrelated errors', () => {
    expect(dbErrorSuggestions('x: table not found')).toEqual([]);
  });
});
