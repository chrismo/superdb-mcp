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
    expect(result.error).toBeTruthy();
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
  it('points to the database parameter when no database is attached', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'superdb-mcp-noattach-'));
    const prevHome = process.env.HOME;
    process.env.HOME = dir; // empty config dir: nothing attached
    try {
      const result = await superDbQuery({ query: 'from x' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('no database attached');
      expect(result.suggestions!.some(s => s.includes('database'))).toBe(true);
    } finally {
      process.env.HOME = prevHome;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
