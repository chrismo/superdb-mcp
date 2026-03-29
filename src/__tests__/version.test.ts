import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseYMMDDVersion, compareVersions, isVersionAtLeast, getDocsVersion, getVersionScheme, checkDocsCompatibility } from '../lib/version.js';

describe('parseYMMDDVersion', () => {
  it('parses a valid YMMDD version string', () => {
    const date = parseYMMDDVersion('0.50930');
    expect(date).not.toBeNull();
    expect(date!.getUTCFullYear()).toBe(2025);
    expect(date!.getUTCMonth()).toBe(8); // September = 8 (0-indexed)
    expect(date!.getUTCDate()).toBe(30);
  });

  it('parses 0.51231 as 2025-12-31', () => {
    const date = parseYMMDDVersion('0.51231');
    expect(date).not.toBeNull();
    expect(date!.getUTCFullYear()).toBe(2025);
    expect(date!.getUTCMonth()).toBe(11);
    expect(date!.getUTCDate()).toBe(31);
  });

  it('parses 0.60101 as 2026-01-01', () => {
    const date = parseYMMDDVersion('0.60101');
    expect(date).not.toBeNull();
    expect(date!.getUTCFullYear()).toBe(2026);
    expect(date!.getUTCMonth()).toBe(0);
    expect(date!.getUTCDate()).toBe(1);
  });

  it('returns null for invalid format', () => {
    expect(parseYMMDDVersion('1.2.3')).toBeNull();
    expect(parseYMMDDVersion('unknown')).toBeNull();
    expect(parseYMMDDVersion('sha:abc123')).toBeNull();
    expect(parseYMMDDVersion('')).toBeNull();
  });

  it('returns null for malformed YMMDD strings', () => {
    expect(parseYMMDDVersion('0.5')).toBeNull();       // too short
    expect(parseYMMDDVersion('0.512345')).toBeNull();   // too long
  });
});

describe('compareVersions', () => {
  it('returns 0 for equal YMMDD versions', () => {
    expect(compareVersions('0.50930', '0.50930')).toBe(0);
  });

  it('returns -1 when a is older', () => {
    expect(compareVersions('0.50930', '0.51231')).toBe(-1);
  });

  it('returns 1 when a is newer', () => {
    expect(compareVersions('0.51231', '0.50930')).toBe(1);
  });

  it('returns 0 when either version is SHA-based', () => {
    expect(compareVersions('sha:abc123', '0.50930')).toBe(0);
    expect(compareVersions('0.50930', 'sha:abc123')).toBe(0);
    expect(compareVersions('sha:abc', 'sha:def')).toBe(0);
  });

  it('compares semver versions numerically', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.1.0', '0.2.0')).toBe(-1);
    expect(compareVersions('0.10.0', '0.2.0')).toBe(1);
  });

  it('compares across year boundaries', () => {
    expect(compareVersions('0.51231', '0.60101')).toBe(-1);
  });

  it('treats YMMDD pre-releases as older than any semver', () => {
    expect(compareVersions('0.51231', '0.1.0')).toBe(-1);
    expect(compareVersions('0.1.0', '0.51231')).toBe(1);
    expect(compareVersions('0.60101', '0.1.0')).toBe(-1);
  });
});

describe('getVersionScheme', () => {
  it('identifies YMMDD versions', () => {
    expect(getVersionScheme('0.51231')).toBe('ymmdd');
    expect(getVersionScheme('0.60101')).toBe('ymmdd');
  });

  it('identifies semver versions', () => {
    expect(getVersionScheme('0.1.0')).toBe('semver');
    expect(getVersionScheme('1.0.0')).toBe('semver');
  });

  it('identifies SHA versions', () => {
    expect(getVersionScheme('sha:abc123')).toBe('sha');
  });

  it('identifies unknown versions', () => {
    expect(getVersionScheme('unknown')).toBe('unknown');
  });
});

describe('isVersionAtLeast', () => {
  it('returns true when current meets required', () => {
    expect(isVersionAtLeast('0.50930', '0.51231')).toBe(true);
  });

  it('returns true when current equals required', () => {
    expect(isVersionAtLeast('0.50930', '0.50930')).toBe(true);
  });

  it('returns false when current is older than required', () => {
    expect(isVersionAtLeast('0.51231', '0.50930')).toBe(false);
  });
});

describe('checkDocsCompatibility', () => {
  it('uses the provided superPath for version detection', () => {
    const result = checkDocsCompatibility('/nonexistent/custom/super');

    // When a superPath is provided, detectVersion should use it
    // The path shows up in the runtime result even if the binary doesn't exist
    expect(result.runtime.path).toBe('/nonexistent/custom/super');
    expect(result.runtime.source).toBe('override');
  });

  it('uses default path when no superPath given', () => {
    const result = checkDocsCompatibility();

    // Without a superPath, should use default (SUPER_PATH env or 'super')
    const expectedPath = process.env.SUPER_PATH || 'super';
    expect(result.runtime.path).toBe(expectedPath);
  });
});

describe('getDocsVersion', () => {
  it('returns a version string', () => {
    const version = getDocsVersion();
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });

  it('matches the frontmatter in zq-to-super-upgrades.md', async () => {
    const { getDocsDir } = await import('superkit');
    const upgradeDoc = join(getDocsDir(), 'zq-to-super-upgrades.md');
    const content = readFileSync(upgradeDoc, 'utf-8');
    const match = content.match(/superdb_version:\s*"([^"]+)"/);
    expect(match).not.toBeNull();
    expect(getDocsVersion()).toBe(match![1]);
  });

  it('matches the version in tool descriptions in index.ts', () => {
    const indexTs = join(dirname(fileURLToPath(import.meta.url)), '../index.ts');
    const content = readFileSync(indexTs, 'utf-8');
    const version = getDocsVersion();
    const matches = content.matchAll(/content targets (?:SuperDB )?v([0-9.]+)/g);
    for (const m of matches) {
      expect(m[1]).toBe(version);
    }
  });
});
