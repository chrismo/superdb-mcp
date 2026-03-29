import { superGrokPatterns as _superGrokPatterns } from 'superkit';
import type { GrokPatternsResult } from 'superkit';
import { getVersionNote } from '../lib/version.js';

export type { GrokPattern, GrokPatternsResult } from 'superkit';

/**
 * Search/filter grok patterns, with MCP version note.
 */
export function superGrokPatterns(query?: string): GrokPatternsResult & { version_note?: string } {
  const result = _superGrokPatterns(query);
  const versionNote = getVersionNote() ?? undefined;
  return {
    ...result,
    ...(versionNote && { version_note: versionNote }),
  };
}
