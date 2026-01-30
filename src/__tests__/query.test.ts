import { describe, it, expect, beforeAll } from 'vitest';
import { superValidate } from '../tools/query.js';
import { runSuper } from '../lib/super.js';

// Check if super binary is available
let superAvailable = false;

beforeAll(async () => {
  try {
    const result = await runSuper(['--version']);
    superAvailable = result.exitCode === 0;
  } catch {
    superAvailable = false;
  }
});

describe('superValidate', () => {
  it.skipIf(() => !superAvailable)('rejects gibberish syntax', async () => {
    const result = await superValidate('this is not valid syntax at all!!!');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it.skipIf(() => !superAvailable)('rejects old "over" syntax', async () => {
    const result = await superValidate('over this');
    expect(result.valid).toBe(false);
    expect(result.suggestions.some(s => s.includes('unnest'))).toBe(true);
  });

  it.skipIf(() => !superAvailable)('rejects old "yield" syntax', async () => {
    const result = await superValidate('yield 1');
    expect(result.valid).toBe(false);
    expect(result.suggestions.some(s => s.includes('values'))).toBe(true);
  });

  it.skipIf(() => !superAvailable)('accepts valid SuperDB syntax', async () => {
    const result = await superValidate('values 1');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it.skipIf(() => !superAvailable)('accepts valid unnest syntax', async () => {
    const result = await superValidate('unnest this');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it.skipIf(() => !superAvailable)('provides line/column info on parse errors', async () => {
    const result = await superValidate('values {incomplete:');
    expect(result.valid).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]).toHaveProperty('line');
    expect(result.diagnostics[0]).toHaveProperty('character');
  });
});
