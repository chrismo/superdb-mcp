import { getLspClient, checkLspAvailability, LSPAvailability } from '../lib/lsp-client.js';

export interface CompletionResult {
  success: boolean;
  completions: Array<{
    label: string;
    kind?: string;
    detail?: string;
    documentation?: string;
    insertText?: string;
  }>;
  lsp_available: boolean;
  error: string | null;
}

export interface DocsResult {
  success: boolean;
  query: string;
  position: { line: number; character: number };
  documentation: string | null;
  lsp_available: boolean;
  error: string | null;
}

// Map LSP completion kinds to human-readable names
const completionKindNames: Record<number, string> = {
  1: 'text',
  2: 'method',
  3: 'function',
  4: 'constructor',
  5: 'field',
  6: 'variable',
  7: 'class',
  8: 'interface',
  9: 'module',
  10: 'property',
  11: 'unit',
  12: 'value',
  13: 'enum',
  14: 'keyword',
  15: 'snippet',
  16: 'color',
  17: 'file',
  18: 'reference',
  19: 'folder',
  20: 'enumMember',
  21: 'constant',
  22: 'struct',
  23: 'event',
  24: 'operator',
  25: 'typeParameter',
};

/**
 * Get code completions for a query at a position
 */
export async function superComplete(
  query: string,
  line: number,
  character: number
): Promise<CompletionResult> {
  const client = getLspClient();

  if (!client) {
    const availability = checkLspAvailability();
    return {
      success: false,
      completions: [],
      lsp_available: false,
      error: availability.error || 'LSP not available',
    };
  }

  try {
    const items = await client.getCompletions(query, line, character);

    const completions = items.map((item) => {
      let documentation: string | undefined;
      if (typeof item.documentation === 'string') {
        documentation = item.documentation;
      } else if (item.documentation && typeof item.documentation === 'object') {
        documentation = item.documentation.value;
      }

      return {
        label: item.label,
        kind: item.kind ? completionKindNames[item.kind] : undefined,
        detail: item.detail,
        documentation,
        insertText: item.insertText,
      };
    });

    return {
      success: true,
      completions,
      lsp_available: true,
      error: null,
    };
  } catch (e) {
    return {
      success: false,
      completions: [],
      lsp_available: true,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Get documentation for a symbol at a position in a query
 */
export async function superDocs(
  query: string,
  line: number,
  character: number
): Promise<DocsResult> {
  const client = getLspClient();

  if (!client) {
    const availability = checkLspAvailability();
    return {
      success: false,
      query,
      position: { line, character },
      documentation: null,
      lsp_available: false,
      error: availability.error || 'LSP not available',
    };
  }

  try {
    const hover = await client.getHover(query, line, character);

    let documentation: string | null = null;
    if (hover) {
      if (typeof hover.contents === 'string') {
        documentation = hover.contents;
      } else if (hover.contents && typeof hover.contents === 'object') {
        documentation = hover.contents.value;
      }
    }

    return {
      success: true,
      query,
      position: { line, character },
      documentation,
      lsp_available: true,
      error: null,
    };
  } catch (e) {
    return {
      success: false,
      query,
      position: { line, character },
      documentation: null,
      lsp_available: true,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Get LSP availability status
 */
export function getLspStatus(): LSPAvailability {
  return checkLspAvailability();
}
