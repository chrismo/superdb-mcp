import { describe, it, expect, beforeAll } from 'vitest';
import { superInfo, superHelp } from '../tools/info.js';
import { resolveSuperPath } from '../lib/asdf.js';
import { getDocsVersion } from '../lib/version.js';

// Check if a specific version is installed via ASDF
function isVersionInstalled(version: string): boolean {
  try {
    resolveSuperPath(version);
    return true;
  } catch {
    return false;
  }
}

const docsVersion = getDocsVersion();
const docsVersionInstalled = isVersionInstalled(docsVersion);

describe('superInfo', () => {
  it.skipIf(!docsVersionInstalled)(
    'compatibility check uses the overridden version, not the default',
    () => {
      const result = superInfo(undefined, docsVersion);

      expect(result.success).toBe(true);
      // Runtime should reflect the requested version
      expect(result.runtime.version).toBe(docsVersion);
      // Compatibility should compare the overridden runtime against docs,
      // not the default binary. Since we're requesting the docs version,
      // they should match.
      expect(result.compatibility.runtime_docs_match).toBe(true);
      expect(result.compatibility.warnings).toHaveLength(0);
    }
  );
});

describe('superHelp upgrade guide', () => {
  it('includes the v0.4.0 gotchas added in superkit 1.4.1', () => {
    const result = superHelp('upgrade');
    expect(result.success).toBe(true);
    expect(result.content).toContain('`exists()` is not a replacement for `has()`');
    expect(result.content).toContain('data: file format required');
    expect(result.content).toContain('Convert JSUP files before upgrading');
  });
});
