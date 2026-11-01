import { spawn } from 'child_process';

export interface SuperResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Get the path to the super binary
 */
export function getSuperPath(): string {
  return process.env.SUPER_PATH || 'super';
}

/**
 * Execute the super binary with given arguments
 */
export async function runSuper(args: string[], stdin?: string, superPath?: string): Promise<SuperResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(superPath || getSuperPath(), args);
    let stdout = '';
    let stderr = '';

    // super can exit before reading all of stdin (e.g. on a parse error).
    // The write then fails with EPIPE, which crashes the process unless
    // handled; the exit code and stderr already report what went wrong.
    proc.stdin.on('error', () => {});
    if (stdin !== undefined) {
      proc.stdin.write(stdin);
    }
    proc.stdin.end();

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn super: ${err.message}`));
    });
  });
}

/**
 * Execute a `super db` command (SuperDB v0.4.0+).
 *
 * `subcommand` is e.g. 'ls', 'load', or 'create'; pass null to run a query
 * (`super db -c ...` — there is no `query` subcommand). `database` is passed
 * as `-attach`, which applies to this command only; without it, super uses
 * the database attached with `super db attach`.
 */
export async function runSuperDb(
  subcommand: string | null,
  args: string[],
  database?: string,
  superPath?: string,
  stdin?: string,
): Promise<SuperResult> {
  const fullArgs = subcommand ? ['db', subcommand] : ['db'];
  if (database) {
    fullArgs.push('-attach', database);
  }
  fullArgs.push(...args);
  return runSuper(fullArgs, stdin, superPath);
}

/**
 * Parse newline-delimited JSON output from super
 */
export function parseNDJSON(output: string): unknown[] {
  const lines = output.trim().split('\n').filter(Boolean);
  return lines.map(line => JSON.parse(line));
}

/**
 * Safely parse JSON, returning null on failure
 */
export function tryParseJSON(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
