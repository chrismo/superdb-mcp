/**
 * Output format handling for `super -f`.
 *
 * `runSuper` accumulates stdout as a UTF-8 string, so any format emitting
 * non-UTF-8 bytes is corrupted before a caller can see it. Only text formats
 * are supported; binary ones are rejected explicitly rather than returned
 * mangled.
 */

/** Text formats, mapped to the flags that select them. */
const FORMAT_ARGS: Record<string, string[]> = {
  json: ['-j'],
  sup: ['-s'],
  csv: ['-f', 'csv'],
  table: ['-f', 'table'],
  line: ['-f', 'line'],
  tsv: ['-f', 'tsv'],
  jsup: ['-f', 'jsup'],
  zeek: ['-f', 'zeek'],
};

/** Formats `super -f` accepts but that cannot survive UTF-8 decoding. */
const BINARY_FORMATS = ['arrows', 'bsup', 'csup', 'db', 'parquet'];

export const OUTPUT_FORMATS = Object.keys(FORMAT_ARGS);

export type OutputFormat = 'json' | 'sup' | 'csv' | 'table' | 'line' | 'tsv' | 'jsup' | 'zeek';

/**
 * Resolve a format to its CLI flags, or explain why it was rejected.
 *
 * Never returns empty args: omitting an output flag makes `super` fall back to
 * its bsup default, which is the silent-binary failure this guards against.
 */
export function resolveFormatArgs(format: string): { args: string[]; error: null } | { args: null; error: string } {
  const args = FORMAT_ARGS[format];
  if (args) {
    return { args, error: null };
  }
  if (BINARY_FORMATS.includes(format)) {
    return {
      args: null,
      error: `binary output format '${format}' is not supported: this server returns text, and binary output is corrupted by UTF-8 decoding. Use one of: ${OUTPUT_FORMATS.join(', ')}`,
    };
  }
  return {
    args: null,
    error: `unknown format '${format}'. Expected one of: ${OUTPUT_FORMATS.join(', ')}`,
  };
}
