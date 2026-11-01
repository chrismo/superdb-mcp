import { basename } from 'path';
import { runSuper, parseNDJSON } from '../lib/super.js';
import { resolveSuperPath } from '../lib/asdf.js';
import { resolveFormatArgs, type OutputFormat } from '../lib/formats.js';

export interface QueryParams {
  query: string;
  files?: string[];
  data?: string;
  format?: OutputFormat;
  inputFormat?: string;
  /** Statically type-check all inputs (`super -static`). Needed for some SQL on JSON input. */
  static?: boolean;
  version?: string;
}

export interface QueryResult {
  success: boolean;
  data: unknown[] | null;
  rowCount: number;
  raw?: string;
  debug?: string;
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
 * Errors that name resolution or signatures can answer — the cases where
 * super_docs is worth reaching for. Anything else (bad paths, encoding errors,
 * syntax) it cannot help with.
 */
const LOOKUP_ERRORS = /no such function|no such user operator|too many arguments|too few arguments/;

/**
 * Extract the source text a super error underlines.
 *
 * Errors that point into the query carry the offending token on the line below
 * it, underlined with tildes:
 *
 *   file does not exist at line 1, column 15:
 *   select * from "test-data.json"
 *                 ~~~~~~~~~~~~~~~~
 */
function underlinedToken(error: string): string | null {
  const lines = error.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const marks = lines[i].match(/^(\s*)(~+)$/);
    if (!marks) continue;
    const token = lines[i - 1].slice(marks[1].length, marks[1].length + marks[2].length);
    return token.replace(/^["']|["']$/g, '') || null;
  }
  return null;
}

/**
 * Functions and operators removed or renamed in SuperDB v0.4.0, keyed by the
 * old name. Matched against the name super underlines in a
 * "no such function" / "no such user operator" error.
 */
const REMOVED_IN_V040: Record<string, string> = {
  has: 'has(x) was replaced by is_ok(x) in SuperDB v0.4.0',
  quiet: 'quiet(x) was removed in SuperDB v0.4.0; use ok(x), which turns errors into none (e.g. ok(x) ?? default)',
  fields: 'fields(x) was replaced by paths(x) in SuperDB v0.4.0 (paths also descends into arrays and maps); for top-level keys use keys(x)',
  max: 'The two-argument max(a, b) was renamed greatest(a, b) in SuperDB v0.4.0 (the max() aggregate is unchanged)',
  min: 'The two-argument min(a, b) was renamed least(a, b) in SuperDB v0.4.0 (the min() aggregate is unchanged)',
  unblend: 'unblend() was renamed defuse() in SuperDB v0.4.0 (and the old defuse() is now superdefuse())',
  blend: 'The blend operator was renamed fuse in SuperDB v0.4.0 (and the old fuse is now superfuse)',
};

/** Suggestions for errors caused by SuperDB v0.4.0 breaking changes. */
function v040Suggestions(query: string, error: string): string[] {
  const suggestions: string[] = [];

  // "no such function" underlines the call (`has(a)`); "no such user
  // operator" quotes the name (`no such user operator: "blend"`).
  let name: string | undefined;
  if (error.includes('no such function')) {
    name = underlinedToken(error)?.match(/^(\w+)\s*\(/)?.[1];
  } else {
    name = error.match(/no such user operator: "(\w+)"/)?.[1];
  }
  if (name && REMOVED_IN_V040[name]) {
    suggestions.push(REMOVED_IN_V040[name]);
  }

  // `missing` is now a type name, so missing(x) is a parse error.
  if (error.includes('parse error') && /\bmissing\s*\(/.test(query)) {
    suggestions.push('missing(x) was removed in SuperDB v0.4.0; use not is_ok(x)');
  }
  if (error.includes('parse error') && query.includes('|[')) {
    suggestions.push('Set literals are written set[1,2] as of SuperDB v0.4.0 (was |[1,2]|)');
  }
  if (error.includes('parse error') && query.includes('|{')) {
    suggestions.push('Map literals are written map{"a":1} as of SuperDB v0.4.0 (was |{"a":1}|)');
  }

  if (/: file format required$/m.test(error)) {
    suggestions.push('As of SuperDB v0.4.0, a local file\'s format comes from its extension. For a file with no recognized extension, set the inputFormat parameter (e.g. "json", "sup", "csv", or "auto").');
  }

  if (error.includes('cannot be used for dynamic inputs') || error.includes('requires table-qualified reference')) {
    suggestions.push('This SQL needs statically typed input. JSON and CSV inputs are dynamic as of SuperDB v0.4.0; set the static parameter to true (super -static).');
  }

  if (error.includes('cannot cast to time: type not yet implemented')) {
    suggestions.push('The time type was renamed timestamp in SuperDB v0.4.0; ::time now means the (unimplemented) SQL time-of-day type. Use ::timestamp.');
  }

  return suggestions;
}

/**
 * Execute a SuperSQL query
 */
export async function superQuery(params: QueryParams): Promise<QueryResult> {
  const { query, files, data, format = 'json', inputFormat, static: isStatic, version } = params;
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

  // Build arguments
  const args: string[] = [...outputFormat.args];

  // Input format override
  if (inputFormat) {
    args.push('-i', inputFormat);
  }

  if (isStatic) {
    args.push('-static');
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
  const result = await runSuper(args, data, superPath);

  if (result.exitCode !== 0) {
    const error = result.stderr.trim() || 'Query failed with no error message';
    const suggestions: string[] = [];

    // Word-bounded: a bare `includes` matched these inside longer identifiers
    // (e.g. "func" in "nosuchfunc").
    if (/\byield\b/.test(error)) {
      suggestions.push('Did you mean "values"? (yield was renamed to values in SuperDB)');
    }
    if (/\bover\b/.test(error)) {
      suggestions.push('Did you mean "unnest"? (over was renamed to unnest in SuperDB)');
    }
    // Match the literal in the query, not the error: /.*/ against the error
    // text tripped on any absolute path super echoed back.
    if (error.includes('parse error') && /(^|[\s(=~,|])\/[^/\s]+\/([\s)|,]|$)/.test(query)) {
      suggestions.push('Inline regex /pattern/ is not supported. Use string patterns: \'pattern\'');
    }
    if (/\bfunc\b/.test(error)) {
      suggestions.push('Did you mean "fn"? (func was renamed to fn in SuperDB)');
    }
    if (error.includes('type mismatch') && error.includes('string + string')) {
      suggestions.push('The + operator no longer concatenates strings. Use f-string interpolation (preferred): f\'{a}{b}\', or || operator, or concat()');
    }
    if (query.match(/\bop\s+\w+\s*\(/)) {
      suggestions.push('Remove parentheses from operator definition: "op name(a, b):" should be "op name a, b:"');
    }
    // A FROM clause and the files parameter are mutually exclusive: files
    // become super's stdin, and `from` refuses to run with a parent.
    if (error.includes('from operator cannot have parent')) {
      suggestions.push('Do not combine the files parameter with a FROM clause. Either drop files and put the absolute path in the query (FROM "/abs/path"), or drop FROM and let files feed the pipeline.');
    }

    // `<path>: file does not exist` — a path in the files parameter is missing.
    // Unrelated to FROM resolution, so it gets no FROM advice.
    const missingInput = error.match(/^(.+): file does not exist$/m);
    if (missingInput) {
      suggestions.push(`The file "${missingInput[1]}" does not exist. Check the path in the files parameter.`);
    } else if (error.includes('file does not exist')) {
      // `file does not exist at line L, column C:` — a path inside the query.
      // The name is not in the message; it is underlined on the line below.
      const token = underlinedToken(error);
      suggestions.push(
        token
          ? `The path "${token}" in your FROM clause was not found. FROM resolves relative paths against the server's working directory, not yours — use an absolute path.`
          : 'FROM clauses resolve relative paths against the server\'s working directory. Use absolute paths in FROM clauses.'
      );
    }

    // Bare paths with hyphens or dots do not parse as identifiers.
    if (error.includes('parse error') && /\bfrom\s+[^\s'"]*[-.][^\s'"]*/i.test(query)) {
      suggestions.push('Quote the path in your FROM clause: FROM "some-file.json". Unquoted paths containing "-" or "." are not valid identifiers.');
    }

    suggestions.push(...v040Suggestions(query, error));

    // Nudge toward LSP tools when available and error suggests a function/keyword issue
    if (process.env.SUPERDB_LSP_PATH && LOOKUP_ERRORS.test(error)) {
      suggestions.push('Tip: use super_docs to look up function signatures and keyword documentation before retrying.');
    }

    return {
      success: false,
      data: null,
      rowCount: 0,
      error,
      ...(suggestions.length > 0 && { suggestions }),
    };
  }

  // Capture debug operator output from stderr (emitted in SUP format)
  const debugOutput = result.stderr.trim() || undefined;

  // Some v0.4.0 breakage shows up as error values in otherwise-successful
  // output rather than as a failed query.
  const outputSuggestions = v040Suggestions(query, result.stdout);
  const suggestionsField = outputSuggestions.length > 0 ? { suggestions: outputSuggestions } : {};

  // Parse output based on format
  if (format === 'json') {
    try {
      const parsed = parseNDJSON(result.stdout);
      return {
        success: true,
        data: parsed,
        rowCount: parsed.length,
        ...(debugOutput && { debug: debugOutput }),
        ...suggestionsField,
        error: null,
      };
    } catch (e) {
      return {
        success: true,
        data: null,
        rowCount: 0,
        raw: result.stdout,
        ...(debugOutput && { debug: debugOutput }),
        ...suggestionsField,
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
      ...(debugOutput && { debug: debugOutput }),
      ...suggestionsField,
      error: null,
    };
  }
}

/**
 * Inspect schema/types of a file by finding unique shapes
 */
export async function superSchema(file: string, version?: string): Promise<SchemaResult> {
  const superPath = resolveSuperPath(version);
  // Use aggregation to find unique shapes with counts and examples
  const query = 'count(), any(this) by typeof(this) | sort -r count';
  const result = await runSuper(['-j', '-c', query, file], undefined, superPath);

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
