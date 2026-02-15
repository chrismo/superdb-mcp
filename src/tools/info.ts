import { readFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import {
  detectVersion,
  compareVersionInfo,
  checkDocsCompatibility,
  getVersionNote,
  VersionInfo,
  VersionComparison,
} from '../lib/version.js';
import { runSuper } from '../lib/super.js';

// Get paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const docsDir = join(__dirname, '../../docs');
const packageJsonPath = join(__dirname, '../../package.json');

// Read MCP version from package.json
function getMcpVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

export interface LspSetup {
  recommendation: string;
  benefits: string[];
  releases_url: string;
  platforms: Record<string, string>;
  install_steps: string[];
  env_var: string;
}

export interface InfoResult {
  success: boolean;
  mcp_version: string;
  runtime: VersionInfo;
  docs_version: string;
  lsp_available: boolean;
  lsp_path: string | null;
  lsp_setup: LspSetup | null;
  compatibility: {
    runtime_docs_match: boolean;
    warnings: string[];
  };
  error: string | null;
}

export interface CompareResult {
  success: boolean;
  comparison: VersionComparison | null;
  error: string | null;
}

export interface HelpResult {
  success: boolean;
  topic: string;
  content: string;
  version_note?: string;
  error: string | null;
}

export interface CompatTestResult {
  success: boolean;
  query: string;
  results: Array<{
    path: string;
    version: string;
    success: boolean;
    output?: string;
    error?: string;
  }>;
  breaking_change_detected: boolean;
  error: string | null;
}

export interface LspStatusResult {
  available: boolean;
  path: string | null;
  setup: LspSetup | null;
}

/**
 * Get LSP availability status and installation instructions
 */
export function superLspStatus(): LspStatusResult {
  const lspPath = process.env.SUPERDB_LSP_PATH || null;
  let available = false;

  if (lspPath) {
    try {
      const result = spawnSync(lspPath, ['--version'], { timeout: 2000, encoding: 'utf-8' });
      available = result.status === 0;
    } catch {
      available = false;
    }
  }

  const setup: LspSetup | null = available
    ? null
    : {
        recommendation: 'Install SuperDB LSP for enhanced query assistance',
        benefits: [
          'Better query suggestions via code completions',
          'Function and keyword documentation lookup',
          'Enhanced error diagnostics with fix suggestions',
        ],
        releases_url: 'https://github.com/chrismo/superdb-lsp/releases',
        platforms: {
          'macOS (Apple Silicon)': 'superdb-lsp-darwin-arm64',
          'macOS (Intel)': 'superdb-lsp-darwin-amd64',
          'Linux (x64)': 'superdb-lsp-linux-amd64',
          'Linux (ARM64)': 'superdb-lsp-linux-arm64',
          'Windows (x64)': 'superdb-lsp-windows-amd64.exe',
        },
        install_steps: [
          'Download the appropriate binary for your platform from the releases page',
          'Make it executable: chmod +x superdb-lsp-*',
          'Move it to a location in your PATH or note its full path',
          'Set the environment variable: export SUPERDB_LSP_PATH=/path/to/superdb-lsp',
          'Add the export to your shell profile (~/.bashrc, ~/.zshrc, etc.) for persistence',
        ],
        env_var: 'SUPERDB_LSP_PATH',
      };

  return {
    available,
    path: lspPath,
    setup,
  };
}

/**
 * Get SuperDB version and environment info
 */
export function superInfo(compareTo?: string): InfoResult {
  try {
    const runtime = detectVersion();
    const compatibility = checkDocsCompatibility();

    // Check for LSP
    const lspPath = process.env.SUPERDB_LSP_PATH || null;
    let lspAvailable = false;
    if (lspPath) {
      try {
        const result = spawnSync(lspPath, ['--version'], { timeout: 2000, encoding: 'utf-8' });
        lspAvailable = result.status === 0;
      } catch {
        lspAvailable = false;
      }
    }

    // Provide setup instructions if LSP is not configured
    const lspSetup: LspSetup | null = lspAvailable
      ? null
      : {
          recommendation: 'Install SuperDB LSP for enhanced query assistance',
          benefits: [
            'Better query suggestions via code completions',
            'Function and keyword documentation lookup',
            'Enhanced error diagnostics with fix suggestions',
          ],
          releases_url: 'https://github.com/chrismo/superdb-lsp/releases',
          platforms: {
            'macOS (Apple Silicon)': 'superdb-lsp-darwin-arm64',
            'macOS (Intel)': 'superdb-lsp-darwin-amd64',
            'Linux (x64)': 'superdb-lsp-linux-amd64',
            'Linux (ARM64)': 'superdb-lsp-linux-arm64',
            'Windows (x64)': 'superdb-lsp-windows-amd64.exe',
          },
          install_steps: [
            'Download the appropriate binary for your platform from the releases page',
            'Make it executable: chmod +x superdb-lsp-*',
            'Move it to a location in your PATH or note its full path',
            'Set the environment variable: export SUPERDB_LSP_PATH=/path/to/superdb-lsp',
            'Add the export to your shell profile (~/.bashrc, ~/.zshrc, etc.) for persistence',
          ],
          env_var: 'SUPERDB_LSP_PATH',
        };

    return {
      success: true,
      mcp_version: getMcpVersion(),
      runtime,
      docs_version: compatibility.docs,
      lsp_available: lspAvailable,
      lsp_path: lspPath,
      lsp_setup: lspSetup,
      compatibility: {
        runtime_docs_match: compatibility.compatible,
        warnings: compatibility.warnings,
      },
      error: null,
    };
  } catch (e) {
    return {
      success: false,
      mcp_version: getMcpVersion(),
      runtime: {
        version: 'unknown',
        scheme: 'unknown',
        raw: '',
        date: null,
        sha: null,
        timestamp: null,
        path: 'super',
        source: 'path',
      },
      docs_version: 'unknown',
      lsp_available: false,
      lsp_path: null,
      lsp_setup: null,
      compatibility: {
        runtime_docs_match: false,
        warnings: ['Failed to detect version info'],
      },
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Compare two SuperDB versions
 */
export function superCompare(currentPath?: string, compareToPath?: string): CompareResult {
  try {
    const comparison = compareVersionInfo(currentPath, compareToPath);
    return {
      success: true,
      comparison,
      error: null,
    };
  } catch (e) {
    return {
      success: false,
      comparison: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Get help documentation
 */
/**
 * List available tutorial names from docs/tutorials/
 */
function listTutorials(): string[] {
  const tutorialsDir = join(docsDir, 'tutorials');
  try {
    return readdirSync(tutorialsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => basename(f, '.md'))
      .sort();
  } catch {
    return [];
  }
}

export function superHelp(topic: string): HelpResult {
  const topics: Record<string, string> = {
    'expert': 'superdb-expert.md',
    'upgrade': 'zq-to-super-upgrades.md',
    'upgrade-guide': 'zq-to-super-upgrades.md',
    'migration': 'zq-to-super-upgrades.md',
  };

  const normalized = topic.toLowerCase();
  const versionNote = getVersionNote() ?? undefined;

  // Handle "tutorials" topic — list available tutorials
  if (normalized === 'tutorials') {
    const tutorials = listTutorials();
    const listing = tutorials.length > 0
      ? tutorials.map(t => `- tutorial:${t}`).join('\n')
      : 'No tutorials found.';
    return {
      success: true,
      topic,
      content: `# Available Tutorials\n\nUse \`super_help\` with topic \`"tutorial:<name>"\` to read a specific tutorial.\n\n${listing}`,
      ...(versionNote && { version_note: versionNote }),
      error: null,
    };
  }

  // Handle "tutorial:<name>" topics
  if (normalized.startsWith('tutorial:')) {
    const tutorialName = normalized.slice('tutorial:'.length);
    const tutorialsDir = join(docsDir, 'tutorials');
    // Try exact match, then with underscores replaced by hyphens
    const candidates = [
      `${tutorialName}.md`,
      `${tutorialName.replace(/-/g, '_')}.md`,
      `${tutorialName.replace(/_/g, '-')}.md`,
    ];

    for (const candidate of candidates) {
      try {
        const filepath = join(tutorialsDir, candidate);
        const content = readFileSync(filepath, 'utf-8');
        return {
          success: true,
          topic,
          content,
          ...(versionNote && { version_note: versionNote }),
          error: null,
        };
      } catch {
        // Try next candidate
      }
    }

    const tutorials = listTutorials();
    return {
      success: false,
      topic,
      content: '',
      error: `Unknown tutorial: ${tutorialName}. Available tutorials: ${tutorials.join(', ')}`,
    };
  }

  const filename = topics[normalized];
  if (!filename) {
    const tutorials = listTutorials();
    const allTopics = [
      ...Object.keys(topics),
      'tutorials',
      ...tutorials.map(t => `tutorial:${t}`),
    ];
    return {
      success: false,
      topic,
      content: '',
      error: `Unknown topic: ${topic}. Available topics: ${allTopics.join(', ')}`,
    };
  }

  try {
    const filepath = join(docsDir, filename);
    const content = readFileSync(filepath, 'utf-8');
    return {
      success: true,
      topic,
      content,
      ...(versionNote && { version_note: versionNote }),
      error: null,
    };
  } catch (e) {
    return {
      success: false,
      topic,
      content: '',
      error: `Failed to read documentation: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Test query compatibility across multiple super versions
 */
export async function superTestCompat(
  query: string,
  versions: string[]
): Promise<CompatTestResult> {
  if (versions.length === 0) {
    return {
      success: false,
      query,
      results: [],
      breaking_change_detected: false,
      error: 'No versions specified to test',
    };
  }

  const results: CompatTestResult['results'] = [];
  let hasSuccess = false;
  let hasFailure = false;

  for (const versionPath of versions) {
    const versionInfo = detectVersion(versionPath);

    try {
      // Temporarily override SUPER_PATH
      const originalPath = process.env.SUPER_PATH;
      process.env.SUPER_PATH = versionPath;

      const result = await runSuper(['-c', query]);

      // Restore original
      if (originalPath) {
        process.env.SUPER_PATH = originalPath;
      } else {
        delete process.env.SUPER_PATH;
      }

      if (result.exitCode === 0) {
        hasSuccess = true;
        results.push({
          path: versionPath,
          version: versionInfo.version,
          success: true,
          output: result.stdout.trim(),
        });
      } else {
        hasFailure = true;
        results.push({
          path: versionPath,
          version: versionInfo.version,
          success: false,
          error: result.stderr.trim() || 'Query failed with no error message',
        });
      }
    } catch (e) {
      hasFailure = true;
      results.push({
        path: versionPath,
        version: versionInfo.version,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    success: true,
    query,
    results,
    breaking_change_detected: hasSuccess && hasFailure,
    error: null,
  };
}
