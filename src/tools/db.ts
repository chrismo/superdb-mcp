import { runSuperDb, parseNDJSON } from '../lib/super.js';
import { resolveSuperPath } from '../lib/asdf.js';
import { resolveFormatArgs, type OutputFormat } from '../lib/formats.js';

// SuperDB v0.4.0 renamed database "pools" to "tables" and replaced
// `super db auth`/`login` and SUPER_DB with `super db attach`. These tools
// target that release: `database` is passed as `-attach <path>`, and when it
// is omitted super uses the attached database.

export interface TableInfo {
  name: string;
  id: string;
  /** Sort keys as "path:order", e.g. "ts:desc". Empty for unsorted tables. */
  sortKeys: string[];
  /** True for tables created with SQL CREATE TABLE (with column types). */
  sql: boolean;
}

export interface DbListResult {
  success: boolean;
  tables: TableInfo[];
  error: string | null;
}

export interface DbListParams {
  database?: string;
  version?: string;
}

export interface DbQueryParams {
  query: string;
  table?: string;
  database?: string;
  format?: OutputFormat;
  version?: string;
}

export interface DbQueryResult {
  success: boolean;
  data: unknown[] | null;
  rowCount: number;
  raw?: string;
  error: string | null;
  suggestions?: string[];
}

const NO_DATABASE_HINT =
  'Pass the database parameter (a database path or URL), or attach one with `super db attach <location>`. Create a new database with `super db init <path>`.';

export interface DbLoadParams {
  table: string;
  files?: string[];
  data?: string;
  database?: string;
  version?: string;
}

export interface DbLoadResult {
  success: boolean;
  message: string;
  error: string | null;
}

export interface DbCreateTableParams {
  name: string;
  /** Sort key, optionally with ":asc" or ":desc", e.g. "ts:desc". */
  orderBy?: string;
  /** SUP type every loaded value is cast to, e.g. "{id:int64,msg:string}". */
  type?: string;
  database?: string;
  version?: string;
}

export interface DbCreateTableResult {
  success: boolean;
  message: string;
  error: string | null;
}

interface RawTable {
  name: string;
  id: string;
  sortkeys?: Array<{ order: string; path: string[] }> | null;
  sql?: boolean;
}

/**
 * List the tables in a database.
 */
export async function superDbList(params: DbListParams = {}): Promise<DbListResult> {
  const { database, version } = params;
  const superPath = resolveSuperPath(version);
  const result = await runSuperDb('ls', ['-j'], database, superPath);

  if (result.exitCode !== 0) {
    return {
      success: false,
      tables: [],
      error: result.stderr.trim() || 'Failed to list tables',
    };
  }

  try {
    const tables = (parseNDJSON(result.stdout) as RawTable[]).map(t => ({
      name: t.name,
      id: t.id,
      sortKeys: (t.sortkeys ?? []).map(k => `${k.path.join('.')}:${k.order}`),
      sql: t.sql ?? false,
    }));
    return { success: true, tables, error: null };
  } catch (e) {
    return {
      success: false,
      tables: [],
      error: `Failed to parse table list: ${e instanceof Error ? e.message : e}`,
    };
  }
}

/**
 * Run a query or SQL statements against a database.
 */
export async function superDbQuery(params: DbQueryParams): Promise<DbQueryResult> {
  const { query, table, database, format = 'json', version } = params;
  const superPath = resolveSuperPath(version);

  // Output format
  const outputFormat = resolveFormatArgs(format);
  if (outputFormat.args === null) {
    return {
      success: false,
      data: null,
      rowCount: 0,
      error: outputFormat.error,
    };
  }

  const args: string[] = [...outputFormat.args];

  // Query - if a table is specified, prepend a FROM clause
  let fullQuery = query;
  if (table && !/\bfrom\b/i.test(query)) {
    fullQuery = `from ${table} | ${query}`;
  }

  args.push('-c', fullQuery);

  const result = await runSuperDb(null, args, database, superPath);

  if (result.exitCode !== 0) {
    const error = result.stderr.trim() || 'Query failed';
    return {
      success: false,
      data: null,
      rowCount: 0,
      error,
      ...(error.includes('no database attached') && { suggestions: [NO_DATABASE_HINT] }),
    };
  }

  if (format === 'json') {
    try {
      const parsed = parseNDJSON(result.stdout);
      return {
        success: true,
        data: parsed,
        rowCount: parsed.length,
        error: null,
      };
    } catch {
      return {
        success: true,
        data: null,
        rowCount: 0,
        raw: result.stdout,
        error: null,
      };
    }
  }

  return {
    success: true,
    data: null,
    rowCount: 0,
    raw: result.stdout,
    error: null,
  };
}

/**
 * Load files or inline data into a table.
 */
export async function superDbLoad(params: DbLoadParams): Promise<DbLoadResult> {
  const { table, files, data, database, version } = params;
  const superPath = resolveSuperPath(version);

  const args: string[] = ['-use', table];
  let stdin: string | undefined;

  if (files && files.length > 0) {
    args.push(...files);
  } else if (data !== undefined) {
    args.push('-');
    stdin = data;
  } else {
    return {
      success: false,
      message: '',
      error: 'Nothing to load: provide files or data',
    };
  }

  const result = await runSuperDb('load', args, database, superPath, stdin);

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: '',
      error: result.stderr.trim() || 'Failed to load data',
    };
  }

  return {
    success: true,
    message: result.stdout.trim() || 'Data loaded successfully',
    error: null,
  };
}

/**
 * Create a new table.
 */
export async function superDbCreateTable(params: DbCreateTableParams): Promise<DbCreateTableResult> {
  const { name, orderBy, type, database, version } = params;
  const superPath = resolveSuperPath(version);

  const args: string[] = [];
  if (orderBy) {
    args.push('-orderby', orderBy);
  }
  if (type) {
    args.push('-type', type);
  }
  args.push(name);

  const result = await runSuperDb('create', args, database, superPath);

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: '',
      error: result.stderr.trim() || 'Failed to create table',
    };
  }

  return {
    success: true,
    message: result.stdout.trim() || `Table '${name}' created`,
    error: null,
  };
}
