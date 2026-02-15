import { basename } from 'path';
import { runSuper, parseNDJSON } from '../lib/super.js';

export interface QueryParams {
  query: string;
  files?: string[];
  data?: string;
  format?: 'json' | 'sup' | 'csv' | 'table';
  inputFormat?: string;
}

export interface QueryResult {
  success: boolean;
  data: unknown[] | null;
  rowCount: number;
  raw?: string;
  error: string | null;
  suggestions?: string[];
}

export interface ShapeInfo {
  type: string;
  count: number;
  example: unknown;
}

export interface SchemaResult {
  success: boolean;
  shapes: ShapeInfo[];
  totalRecords: number;
  error: string | null;
}

/**
 * Execute a SuperSQL query
 */
export async function superQuery(params: QueryParams): Promise<QueryResult> {
  const { query, files, data, format = 'json', inputFormat } = params;

  // Build arguments
  const args: string[] = [];

  // Output format
  if (format === 'json') {
    args.push('-j');  // Line-oriented JSON
  } else if (format === 'sup') {
    args.push('-s');
  } else if (format === 'csv') {
    args.push('-f', 'csv');
  } else if (format === 'table') {
    args.push('-f', 'table');
  }

  // Input format override
  if (inputFormat) {
    args.push('-i', inputFormat);
  }

  // Query
  args.push('-c', query);

  // Files or stdin
  if (files && files.length > 0) {
    args.push(...files);
  } else if (data !== undefined) {
    args.push('-');  // Read from stdin
  }

  // Execute
  const result = await runSuper(args, data);

  if (result.exitCode !== 0) {
    const error = result.stderr.trim() || 'Query failed with no error message';
    const suggestions: string[] = [];

    if (error.includes('yield')) {
      suggestions.push('Did you mean "values"? (yield was renamed to values in SuperDB)');
    }
    if (error.includes('over')) {
      suggestions.push('Did you mean "unnest"? (over was renamed to unnest in SuperDB)');
    }
    if (error.match(/\/.*\//)) {
      suggestions.push('Inline regex /pattern/ is not supported. Use string patterns: \'pattern\'');
    }
    if (error.includes('func')) {
      suggestions.push('Did you mean "fn"? (func was renamed to fn in SuperDB)');
    }
    if (error.includes('type mismatch') && error.includes('string + string')) {
      suggestions.push('The + operator no longer concatenates strings. Use f-string interpolation (preferred): f\'{a}{b}\', or || operator, or concat()');
    }
    if (query.match(/\bop\s+\w+\s*\(/)) {
      suggestions.push('Remove parentheses from operator definition: "op name(a, b):" should be "op name a, b:"');
    }
    if (error.includes('file does not exist') && files && files.length > 0) {
      const missingMatch = error.match(/file does not exist: (\S+)/);
      const missingName = missingMatch ? missingMatch[1] : null;
      if (missingName) {
        const match = files.find(f => basename(f) === missingName);
        if (match) {
          suggestions.push(`The file "${missingName}" was not found. Use the absolute path in your FROM clause: FROM "${match}"`);
        } else {
          suggestions.push('FROM clauses resolve paths relative to the server\'s working directory, not from the files parameter. Use absolute paths in FROM clauses.');
        }
      } else {
        suggestions.push('FROM clauses resolve paths relative to the server\'s working directory, not from the files parameter. Use absolute paths in FROM clauses.');
      }
    }

    return {
      success: false,
      data: null,
      rowCount: 0,
      error,
      ...(suggestions.length > 0 && { suggestions }),
    };
  }

  // Parse output based on format
  if (format === 'json') {
    try {
      const parsed = parseNDJSON(result.stdout);
      return {
        success: true,
        data: parsed,
        rowCount: parsed.length,
        error: null,
      };
    } catch (e) {
      return {
        success: true,
        data: null,
        rowCount: 0,
        raw: result.stdout,
        error: null,
      };
    }
  } else {
    // For non-JSON formats, return raw output
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
 * Inspect schema/types of a file by finding unique shapes
 */
export async function superSchema(file: string): Promise<SchemaResult> {
  // Use aggregation to find unique shapes with counts and examples
  const query = 'count(), any(this) by typeof(this) | sort -r count';
  const result = await runSuper(['-j', '-c', query, file]);

  if (result.exitCode !== 0) {
    return {
      success: false,
      shapes: [],
      totalRecords: 0,
      error: result.stderr.trim() || 'Failed to read file',
    };
  }

  try {
    const parsed = parseNDJSON(result.stdout) as Array<{
      typeof: string;
      count: number;
      any: unknown;
    }>;

    const shapes: ShapeInfo[] = parsed.map(row => ({
      type: row.typeof,
      count: row.count,
      example: row.any,
    }));

    const totalRecords = shapes.reduce((sum, s) => sum + s.count, 0);

    return {
      success: true,
      shapes,
      totalRecords,
      error: null,
    };
  } catch (e) {
    return {
      success: false,
      shapes: [],
      totalRecords: 0,
      error: `Failed to parse output: ${e}`,
    };
  }
}
