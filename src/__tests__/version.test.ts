import { describe, it, expect } from 'vitest';
import { parseYMMDDVersion, compareVersions, isVersionAtLeast, getDocsVersion } from '../lib/version.js';

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

  it('falls back to string comparison for non-YMMDD versions', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('compares across year boundaries', () => {
    expect(compareVersions('0.51231', '0.60101')).toBe(-1);
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

describe('getDocsVersion', () => {
  it('returns a version string', () => {
    const version = getDocsVersion();
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });
});
