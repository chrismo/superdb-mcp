import { describe, it, expect } from 'vitest';
import { superRecipes } from '../tools/recipes.js';

describe('superRecipes', () => {
  it('returns all recipes when no query provided', () => {
    const result = superRecipes();
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
    expect(result.error).toBeNull();
  });

  it('parses skdoc metadata correctly', () => {
    const result = superRecipes();
    for (const r of result.recipes) {
      expect(r.name).toBeTruthy();
      expect(r.type).toMatch(/^(func|op)$/);
      expect(r.description).toBeTruthy();
      expect(r.source_file).toBeTruthy();
      expect(Array.isArray(r.args)).toBe(true);
      expect(Array.isArray(r.examples)).toBe(true);
    }
  });

  it('finds format_bytes in format recipes', () => {
    const result = superRecipes('format_bytes');
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.recipes[0].name).toBe('sk_format_bytes');
    expect(result.recipes[0].type).toBe('func');
    expect(result.recipes[0].source_file).toBe('format');
  });

  it('finds string functions', () => {
    const result = superRecipes('string');
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
  });

  it('finds capitalize recipe', () => {
    const result = superRecipes('capitalize');
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(1);
    const cap = result.recipes.find(r => r.name === 'sk_capitalize');
    expect(cap).toBeDefined();
    expect(cap!.type).toBe('func');
  });

  it('includes examples for recipes that have them', () => {
    const result = superRecipes('sk_clamp');
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.recipes[0].examples.length).toBeGreaterThan(0);
    expect(result.recipes[0].examples[0].i).toBeTruthy();
    expect(result.recipes[0].examples[0].o).toBeTruthy();
  });

  it('includes args for recipes that have them', () => {
    const result = superRecipes('sk_clamp');
    expect(result.success).toBe(true);
    expect(result.recipes[0].args.length).toBe(3);
    expect(result.recipes[0].args.map(a => a.name)).toEqual(['i', 'min', 'max']);
  });

  it('returns empty results for non-matching query', () => {
    const result = superRecipes('zzzznonexistent');
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
  });

  it('includes recipes from all source files', () => {
    const result = superRecipes();
    const sourceFiles = new Set(result.recipes.map(r => r.source_file));
    expect(sourceFiles.has('array')).toBe(true);
    expect(sourceFiles.has('format')).toBe(true);
    expect(sourceFiles.has('integer')).toBe(true);
    expect(sourceFiles.has('records')).toBe(true);
    expect(sourceFiles.has('string')).toBe(true);
  });
});
