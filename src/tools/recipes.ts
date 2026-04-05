import { superRecipes as _superRecipes } from '@chrismo/superkit';
import type { RecipesResult } from '@chrismo/superkit';
import { getVersionNote } from '../lib/version.js';

export type { RecipeFunction, RecipeArg, RecipeExample, RecipesResult } from '@chrismo/superkit';

/**
 * Search/list recipe functions, with MCP version note.
 */
export function superRecipes(query?: string): RecipesResult & { version_note?: string } {
  const result = _superRecipes(query);
  const versionNote = getVersionNote() ?? undefined;
  return {
    ...result,
    ...(versionNote && { version_note: versionNote }),
  };
}
