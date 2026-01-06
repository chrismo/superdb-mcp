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
export async function runSuper(args: string[], stdin?: string): Promise<SuperResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getSuperPath(), args);
    let stdout = '';
    let stderr = '';

    if (stdin !== undefined) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }

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
 * Execute super db commands
 */
export async function runSuperDb(subcommand: string, args: string[], lake?: string): Promise<SuperResult> {
  const fullArgs = ['db', subcommand];
  if (lake) {
    fullArgs.push('-lake', lake);
  }
  fullArgs.push(...args);
  return runSuper(fullArgs);
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
