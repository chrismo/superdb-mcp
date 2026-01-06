import { spawnSync } from 'child_process';

export interface VersionInfo {
  version: string;        // Normalized YMMDD format (e.g., "0.50930")
  raw: string;            // Raw version string from super --version
  date: Date | null;      // Parsed date if available
  sha: string | null;     // Git commit SHA if available
  timestamp: string | null; // Full timestamp from Go pseudo-version
  path: string;           // Path to super binary used
  source: 'env' | 'path' | 'override';
}

export interface VersionComparison {
  current: VersionInfo;
  compareTo: VersionInfo;
  daysDiff: number;
  currentIsNewer: boolean;
  compatible: boolean;
  warnings: string[];
}

/**
 * Get the path to the super binary
 */
export function getSuperPath(): string {
  return process.env.SUPER_PATH || 'super';
}

/**
 * Parse a Go pseudo-version string
 * Format: v0.0.0-YYYYMMDDHHMMSS-SHA
 * Example: v0.0.0-20250930170057-3b76fa645ee8
 */
function parseGoPseudoVersion(raw: string): {
  version: string;
  date: Date | null;
  sha: string | null;
  timestamp: string | null;
} {
  // Match Go pseudo-version: v0.0.0-YYYYMMDDHHMMSS-SHA
  const pseudoMatch = raw.match(/v0\.0\.0-(\d{14})-([a-f0-9]+)/);
  if (pseudoMatch) {
    const timestamp = pseudoMatch[1];  // "20250930170057"
    const sha = pseudoMatch[2];        // "3b76fa645ee8"

    // Parse timestamp: YYYYMMDDHHMMSS
    const year = parseInt(timestamp.slice(0, 4));
    const month = parseInt(timestamp.slice(4, 6)) - 1;
    const day = parseInt(timestamp.slice(6, 8));
    const hour = parseInt(timestamp.slice(8, 10));
    const minute = parseInt(timestamp.slice(10, 12));
    const second = parseInt(timestamp.slice(12, 14));

    const date = new Date(Date.UTC(year, month, day, hour, minute, second));

    // Convert to YMMDD format (0.50930 for 2025-09-30)
    // Y = last digit of year (5 for 2025), MMDD = month and day
    const ymmdd = `0.${timestamp.slice(3, 4)}${timestamp.slice(4, 8)}`;

    return { version: ymmdd, date, sha, timestamp };
  }

  // Try to match homebrew SHA-only version
  const shaMatch = raw.match(/Version:\s*([a-f0-9]{7,40})/i);
  if (shaMatch) {
    return { version: `sha:${shaMatch[1]}`, date: null, sha: shaMatch[1], timestamp: null };
  }

  // Try to match semantic version
  const semverMatch = raw.match(/v?(\d+\.\d+\.\d+)/);
  if (semverMatch) {
    return { version: semverMatch[1], date: null, sha: null, timestamp: null };
  }

  return { version: 'unknown', date: null, sha: null, timestamp: null };
}

/**
 * Detect the SuperDB version from the configured binary
 */
export function detectVersion(superPath?: string): VersionInfo {
  const path = superPath || getSuperPath();
  const source: 'env' | 'path' | 'override' = superPath
    ? 'override'
    : (process.env.SUPER_PATH ? 'env' : 'path');

  try {
    // Use spawnSync with array args to avoid shell injection
    const result = spawnSync(path, ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (result.error || result.status !== 0) {
      return {
        version: 'unknown',
        raw: result.stderr || '',
        date: null,
        sha: null,
        timestamp: null,
        path,
        source,
      };
    }

    const output = result.stdout.trim();
    const parsed = parseGoPseudoVersion(output);

    return {
      ...parsed,
      raw: output,
      path,
      source,
    };
  } catch {
    return {
      version: 'unknown',
      raw: '',
      date: null,
      sha: null,
      timestamp: null,
      path,
      source,
    };
  }
}

/**
 * Parse a YMMDD version string to a Date
 * Format: 0.YMMDD (e.g., 0.51231 = 2025-12-31)
 */
export function parseYMMDDVersion(version: string): Date | null {
  const match = version.match(/^0\.(\d)(\d{2})(\d{2})$/);
  if (!match) return null;

  const year = 2020 + parseInt(match[1]);
  const month = parseInt(match[2]) - 1;
  const day = parseInt(match[3]);

  return new Date(Date.UTC(year, month, day));
}

/**
 * Compare two version strings
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  // Handle SHA-only versions (can't compare)
  if (a.startsWith('sha:') || b.startsWith('sha:')) {
    return 0;  // Can't compare SHAs meaningfully
  }

  // Try to parse as YMMDD
  const dateA = parseYMMDDVersion(a);
  const dateB = parseYMMDDVersion(b);

  if (dateA && dateB) {
    const diff = dateA.getTime() - dateB.getTime();
    if (diff < 0) return -1;
    if (diff > 0) return 1;
    return 0;
  }

  // Fallback to string comparison
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Check if the current version is at least the required version
 */
export function isVersionAtLeast(required: string, current?: string): boolean {
  const currentVersion = current || detectVersion().version;
  return compareVersions(currentVersion, required) >= 0;
}

/**
 * Compare two SuperDB versions and return detailed info
 */
export function compareVersionInfo(
  currentPath?: string,
  compareToPath?: string
): VersionComparison {
  const current = detectVersion(currentPath);
  const compareTo = detectVersion(compareToPath);

  let daysDiff = 0;
  if (current.date && compareTo.date) {
    daysDiff = Math.round(
      (current.date.getTime() - compareTo.date.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  const currentIsNewer = compareVersions(current.version, compareTo.version) > 0;

  const warnings: string[] = [];

  // Warn if versions are far apart
  if (Math.abs(daysDiff) > 30) {
    warnings.push(
      `Versions are ${Math.abs(daysDiff)} days apart. Syntax may have changed.`
    );
  }

  // Warn if comparing SHA versions
  if (current.version.startsWith('sha:') || compareTo.version.startsWith('sha:')) {
    warnings.push(
      'SHA-only versions detected. Cannot determine relative ordering.'
    );
  }

  return {
    current,
    compareTo,
    daysDiff,
    currentIsNewer,
    compatible: Math.abs(daysDiff) <= 7,  // Within a week
    warnings,
  };
}

/**
 * Read version from embedded docs frontmatter
 */
export function getDocsVersion(): string {
  // This would read from the bundled docs
  // For now, return the version we embedded
  return '0.51231';
}

/**
 * Check compatibility between runtime and docs
 */
export function checkDocsCompatibility(): {
  runtime: VersionInfo;
  docs: string;
  compatible: boolean;
  warnings: string[];
} {
  const runtime = detectVersion();
  const docs = getDocsVersion();

  const warnings: string[] = [];
  let compatible = true;

  if (runtime.version === 'unknown') {
    warnings.push('Could not detect SuperDB version. Some features may not work.');
    compatible = false;
  } else if (runtime.version !== docs && !runtime.version.startsWith('sha:')) {
    const comparison = compareVersions(runtime.version, docs);
    if (comparison < 0) {
      warnings.push(
        `Runtime (${runtime.version}) is older than docs (${docs}). ` +
        `Some documented features may not be available.`
      );
    } else {
      warnings.push(
        `Runtime (${runtime.version}) is newer than docs (${docs}). ` +
        `Some new features may not be documented.`
      );
    }
  }

  return { runtime, docs, compatible, warnings };
}
