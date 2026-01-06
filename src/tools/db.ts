import { runSuperDb, parseNDJSON } from '../lib/super.js';

export interface DbListResult {
  success: boolean;
  pools: unknown[];
  error: string | null;
}

export interface DbQueryParams {
  query: string;
  pool?: string;
  lake?: string;
  format?: 'json' | 'sup' | 'csv' | 'table';
}

export interface DbQueryResult {
  success: boolean;
  data: unknown[] | null;
  rowCount: number;
  raw?: string;
  error: string | null;
}

export interface DbLoadParams {
  pool: string;
  files?: string[];
  data?: string;
  lake?: string;
}

export interface DbLoadResult {
  success: boolean;
  message: string;
  error: string | null;
}

export interface DbCreatePoolParams {
  name: string;
  orderBy?: string;
  lake?: string;
}

export interface DbCreatePoolResult {
  success: boolean;
  message: string;
  error: string | null;
}

/**
 * List all pools in a database
 */
export async function superDbList(lake?: string): Promise<DbListResult> {
  const result = await runSuperDb('ls', [], lake);

  if (result.exitCode !== 0) {
    return {
      success: false,
      pools: [],
      error: result.stderr.trim() || 'Failed to list pools',
    };
  }

  // super db ls outputs pool names, one per line
  const pools = result.stdout.trim().split('\n').filter(Boolean);
  return {
    success: true,
    pools,
    error: null,
  };
}

/**
 * Query data from a database pool
 */
export async function superDbQuery(params: DbQueryParams): Promise<DbQueryResult> {
  const { query, pool, lake, format = 'json' } = params;

  const args: string[] = [];

  // Output format
  if (format === 'json') {
    args.push('-j');
  } else if (format === 'sup') {
    args.push('-s');
  } else if (format === 'csv') {
    args.push('-f', 'csv');
  } else if (format === 'table') {
    args.push('-f', 'table');
  }

  // Query - if pool specified, prepend FROM clause
  let fullQuery = query;
  if (pool && !query.toLowerCase().includes('from')) {
    fullQuery = `from ${pool} | ${query}`;
  }

  args.push('-c', fullQuery);

  const result = await runSuperDb('query', args, lake);

  if (result.exitCode !== 0) {
    return {
      success: false,
      data: null,
      rowCount: 0,
      error: result.stderr.trim() || 'Query failed',
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
  } else {
    return {
      success: true,
      data: null,
      rowCount: 0,
      raw: result.stdout,
      error: null,
    };
  }
}

/**
 * Load data into a pool
 */
export async function superDbLoad(params: DbLoadParams): Promise<DbLoadResult> {
  const { pool, files, data, lake } = params;

  const args: string[] = [pool];

  if (files && files.length > 0) {
    args.push(...files);
  } else if (data !== undefined) {
    args.push('-');
  }

  // For stdin data, we need a different approach
  // runSuperDb doesn't support stdin, so we use runSuper directly
  if (data !== undefined) {
    const { runSuper } = await import('../lib/super.js');
    const fullArgs = ['db', 'load'];
    if (lake) {
      fullArgs.push('-lake', lake);
    }
    fullArgs.push(pool, '-');

    const result = await runSuper(fullArgs, data);

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

  const result = await runSuperDb('load', args, lake);

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
 * Create a new pool
 */
export async function superDbCreatePool(params: DbCreatePoolParams): Promise<DbCreatePoolResult> {
  const { name, orderBy, lake } = params;

  const args: string[] = [];

  if (orderBy) {
    args.push('-orderby', orderBy);
  }

  args.push(name);

  const result = await runSuperDb('create', args, lake);

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: '',
      error: result.stderr.trim() || 'Failed to create pool',
    };
  }

  return {
    success: true,
    message: `Pool '${name}' created successfully`,
    error: null,
  };
}
