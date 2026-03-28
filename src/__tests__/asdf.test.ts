import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAsdfSuperPath, resolveSuperPath, resetPathCache } from '../lib/asdf.js';
import * as fs from 'fs';
import * as os from 'os';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs');
  return {
    ...actual,
    accessSync: vi.fn(),
  };
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof os>('os');
  return {
    ...actual,
    homedir: vi.fn(() => '/home/testuser'),
  };
});

beforeEach(() => {
  resetPathCache();
  vi.mocked(fs.accessSync).mockReset();
  vi.mocked(os.homedir).mockReturnValue('/home/testuser');
  delete process.env.ASDF_DATA_DIR;
});

describe('resolveAsdfSuperPath', () => {
  it('constructs correct path from version string', () => {
    vi.mocked(fs.accessSync).mockImplementation(() => {});

    const result = resolveAsdfSuperPath('0.2.0');
    expect(result).toBe('/home/testuser/.asdf/installs/superdb/0.2.0/bin/super');
  });

  it('handles YMMDD version strings', () => {
    vi.mocked(fs.accessSync).mockImplementation(() => {});

    const result = resolveAsdfSuperPath('0.51231');
    expect(result).toBe('/home/testuser/.asdf/installs/superdb/0.51231/bin/super');
  });

  it('respects ASDF_DATA_DIR env var', () => {
    process.env.ASDF_DATA_DIR = '/custom/asdf';
    vi.mocked(fs.accessSync).mockImplementation(() => {});

    const result = resolveAsdfSuperPath('0.2.0');
    expect(result).toBe('/custom/asdf/installs/superdb/0.2.0/bin/super');
  });

  it('caches resolved paths', () => {
    vi.mocked(fs.accessSync).mockImplementation(() => {});

    resolveAsdfSuperPath('0.2.0');
    resolveAsdfSuperPath('0.2.0');

    expect(fs.accessSync).toHaveBeenCalledTimes(1);
  });

  it('throws descriptive error when binary not found', () => {
    vi.mocked(fs.accessSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(() => resolveAsdfSuperPath('99.99.99')).toThrow(
      /SuperDB version 99\.99\.99 is not installed via ASDF/
    );
    expect(() => resolveAsdfSuperPath('99.99.99')).toThrow(
      /asdf install superdb 99\.99\.99/
    );
  });
});

describe('resolveSuperPath', () => {
  it('returns default getSuperPath() when version is undefined', () => {
    const result = resolveSuperPath(undefined);
    // Should return SUPER_PATH env or 'super'
    expect(result).toBe(process.env.SUPER_PATH || 'super');
  });

  it('treats input with / as direct path', () => {
    vi.mocked(fs.accessSync).mockImplementation(() => {});

    const result = resolveSuperPath('/usr/local/bin/super');
    expect(result).toBe('/usr/local/bin/super');
    expect(fs.accessSync).toHaveBeenCalledWith('/usr/local/bin/super', fs.constants.X_OK);
  });

  it('throws when direct path does not exist', () => {
    vi.mocked(fs.accessSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(() => resolveSuperPath('/nonexistent/super')).toThrow(
      /Super binary not found at: \/nonexistent\/super/
    );
  });

  it('resolves version string via ASDF', () => {
    vi.mocked(fs.accessSync).mockImplementation(() => {});

    const result = resolveSuperPath('0.2.0');
    expect(result).toBe('/home/testuser/.asdf/installs/superdb/0.2.0/bin/super');
  });
});
