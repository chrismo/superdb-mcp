import { accessSync, constants } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getSuperPath } from './super.js';

const ASDF_PLUGIN = 'superdb';
const BINARY_NAME = 'super';

const pathCache = new Map<string, string>();

/**
 * Get the ASDF data directory (where installs live)
 */
function getAsdfDataDir(): string {
  return process.env.ASDF_DATA_DIR || join(homedir(), '.asdf');
}

/**
 * Resolve a SuperDB version string to an absolute binary path via ASDF.
 * Validates the binary exists and is executable. Caches results.
 */
export function resolveAsdfSuperPath(version: string): string {
  const cached = pathCache.get(version);
  if (cached) return cached;

  const binPath = join(getAsdfDataDir(), 'installs', ASDF_PLUGIN, version, 'bin', BINARY_NAME);

  try {
    accessSync(binPath, constants.X_OK);
  } catch {
    throw new Error(
      `SuperDB version ${version} is not installed via ASDF.\n` +
      `Expected binary at: ${binPath}\n` +
      `Install it with: asdf install ${ASDF_PLUGIN} ${version}`
    );
  }

  pathCache.set(version, binPath);
  return binPath;
}

/**
 * Resolve a version parameter to a super binary path.
 *
 * - If version contains '/', treat as a direct binary path (validate it exists).
 * - If version is a version string, resolve via ASDF.
 * - If undefined, return the default from getSuperPath().
 */
export function resolveSuperPath(version?: string): string {
  if (version === undefined) {
    return getSuperPath();
  }

  if (version.includes('/')) {
    // Direct path — validate it exists
    try {
      accessSync(version, constants.X_OK);
    } catch {
      throw new Error(
        `Super binary not found at: ${version}\n` +
        `Ensure the path is correct and the binary is executable.`
      );
    }
    return version;
  }

  return resolveAsdfSuperPath(version);
}

/**
 * Clear the path cache (for testing)
 */
export function resetPathCache(): void {
  pathCache.clear();
}
