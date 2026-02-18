import { describe, it, expect } from 'vitest';
import { superHelp } from '../tools/info.js';

describe('superHelp tutorials', () => {
  it('lists available tutorials with topic "tutorials"', () => {
    const result = superHelp('tutorials');
    expect(result.success).toBe(true);
    expect(result.content).toContain('Available Tutorials');
    expect(result.content).toContain('tutorial:grok');
    expect(result.content).toContain('tutorial:joins');
    expect(result.content).toContain('tutorial:subqueries');
    expect(result.content).toContain('tutorial:unnest');
    expect(result.web_url).toContain('/tutorials');
  });

  it('reads a specific tutorial by name', () => {
    const result = superHelp('tutorial:grok');
    expect(result.success).toBe(true);
    expect(result.content).toContain('grok');
    expect(result.content.length).toBeGreaterThan(100);
    expect(result.web_url).toContain('/tutorials/grok');
  });

  it('reads chess-tiebreaks tutorial', () => {
    const result = superHelp('tutorial:chess-tiebreaks');
    expect(result.success).toBe(true);
    expect(result.content).toContain('Chess Tiebreaks');
  });

  it('handles underscore/hyphen normalization', () => {
    const result = superHelp('tutorial:sup-to-bash');
    expect(result.success).toBe(true);
    expect(result.content).toContain('Bash');
  });

  it('returns error for unknown tutorial', () => {
    const result = superHelp('tutorial:nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tutorial');
  });

  it('still handles existing topics', () => {
    const result = superHelp('expert');
    expect(result.success).toBe(true);
    expect(result.content).toContain('SuperDB');
    expect(result.web_url).toContain('/expert-guide');
  });

  it('includes tutorials in error message for unknown topics', () => {
    const result = superHelp('bogus');
    expect(result.success).toBe(false);
    expect(result.error).toContain('tutorial:');
  });
});
