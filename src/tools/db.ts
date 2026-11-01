import { runSuperDb, parseNDJSON } from '../lib/super.js';
import { resolveSuperPath } from '../lib/asdf.js';
import { resolveFormatArgs, type OutputFormat } from '../lib/formats.js';
import { hasTopLevelFrom } from '../lib/query-text.js';

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
  suggestions?: string[];
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

/**
 * Read the db tools' arguments, accepting the pre-v0.4.0 names `pool` and
 * `lake` from older clients. `name` (for create) also falls back to the
 * table, since every other db tool calls it `table`.
 */
export function dbToolArgs(args: Record<string, unknown> | undefined): {
  table: string | undefined;
  database: string | undefined;
  name: string | undefined;
} {
  const table = (args?.table ?? args?.pool) as string | undefined;
  return {
    table,
    database: (args?.database ?? args?.lake) as string | undefined,
    name: (args?.name as string | undefined) ?? table,
  };
}

/** Suggestions for errors any `super db` command can hit. */
export function dbErrorSuggestions(error: string): string[] {
  const suggestions: string[] = [];
  if (error.includes('no database attached')) {
    suggestions.push('Pass the database parameter (a database path or URL), or attach one with `super db attach <location>`. Create a new database with `super db init <path>`.');
  }
  if (error.includes('flag provided but not defined: -attach')) {
    suggestions.push('The database tools need SuperDB v0.4.0 or later (`-attach`); this super binary is older. Check it with super_info.');
  }
  return suggestions;
}

function failure(error: string): { error: string; suggestions?: string[] } {
  const suggestions = dbErrorSuggestions(error);
  return { error, ...(suggestions.length > 0 && { suggestions }) };
}

/**
 * A FROM clause for a table, optionally `table@branch`. Both parts are quoted,
 * separately: names like `my-table` are not identifiers, and a quoted
 * "table@branch" would name a table called that.
 */
function fromClause(table: string): string {
  const at = table.lastIndexOf('@');
  if (at > 0) {
    return `from ${JSON.stringify(table.slice(0, at))}@${JSON.stringify(table.slice(at + 1))}`;
  }
  return `from ${JSON.stringify(table)}`;
}

/** Validate a table name before passing it to super as an argument. */
function tableNameError(name: unknown, param: string): string | null {
  if (typeof name !== 'string' || name === '') {
    return `Missing required parameter: ${param}`;
  }
  if (name.startsWith('-')) {
    return `Table name "${name}" starts with "-", which super would read as a flag`;
  }
  return null;
}

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
  suggestions?: string[];
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
  suggestions?: string[];
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
      ...failure(result.stderr.trim() || 'Failed to list tables'),
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

  if (typeof query !== 'string' && !table) {
    return { success: false, data: null, rowCount: 0, error: 'Missing required parameter: query (or table)' };
  }

  const args: string[] = [...outputFormat.args];

  // With a table, read from it unless the query has its own top-level FROM.
  let fullQuery = query ?? '';
  if (table && !hasTopLevelFrom(fullQuery)) {
    fullQuery = fullQuery.trim() ? `${fromClause(table)} | ${fullQuery}` : fromClause(table);
  }

  args.push('-c', fullQuery);

  const result = await runSuperDb(null, args, database, superPath);

  // JSON output is parsed even on failure: a SQL batch that fails partway
  // has already committed the earlier statements, and their status records
  // are on stdout.
  let parsed: unknown[] | null = null;
  if (format === 'json') {
    try {
      parsed = parseNDJSON(result.stdout);
    } catch {
      parsed = null;
    }
  }

  if (result.exitCode !== 0) {
    return {
      success: false,
      data: parsed && parsed.length > 0 ? parsed : null,
      rowCount: parsed?.length ?? 0,
      ...failure(result.stderr.trim() || 'Query failed'),
    };
  }

  if (parsed) {
    return { success: true, data: parsed, rowCount: parsed.length, error: null };
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

  const nameError = tableNameError(table, 'table');
  if (nameError) {
    return { success: false, message: '', error: nameError };
  }

  const args: string[] = ['-use', table];
  let stdin: string | undefined;

  if (files && files.length > 0 && data !== undefined) {
    return { success: false, message: '', error: 'Provide files or data, not both' };
  } else if (files && files.length > 0) {
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
      ...failure(result.stderr.trim() || 'Failed to load data'),
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

  const nameError = tableNameError(name, 'name');
  if (nameError) {
    return { success: false, message: '', error: nameError };
  }

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
      ...failure(result.stderr.trim() || 'Failed to create table'),
    };
  }

  return {
    success: true,
    message: result.stdout.trim() || `Table '${name}' created`,
    error: null,
  };
}
