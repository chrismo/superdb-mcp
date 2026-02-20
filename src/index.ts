#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

import { superQuery, superSchema } from './tools/query.js';
import { superDbList, superDbQuery, superDbLoad, superDbCreatePool } from './tools/db.js';
import { superInfo, superCompare, superHelp, superTestCompat, superLspStatus } from './tools/info.js';
import { superComplete, superDocs, getLspStatus } from './tools/lsp.js';
import { superGrokPatterns } from './tools/grok.js';
import { superRecipes } from './tools/recipes.js';

// Get docs directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const docsDir = join(__dirname, '../docs');

const server = new Server(
  {
    name: 'superdb-mcp',
    version: '1.2.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Build dynamic resource list
function buildResources() {
  const staticResources = [
    {
      uri: 'superdb://docs/expert',
      name: 'SuperDB Expert Guide',
      description: 'Comprehensive guide for SuperDB queries, syntax patterns, and best practices. Read this before writing complex queries.',
      mimeType: 'text/markdown',
    },
    {
      uri: 'superdb://docs/upgrade-guide',
      name: 'ZQ to SuperDB Upgrade Guide',
      description: 'Migration guide covering all breaking changes from zq to SuperDB. Essential for upgrading old scripts.',
      mimeType: 'text/markdown',
    },
    {
      uri: 'superdb://docs/grok-patterns',
      name: 'Grok Patterns',
      description: 'Collection of 89 grok patterns for parsing common log formats, timestamps, network addresses, and more.',
      mimeType: 'text/plain',
    },
  ];

  // Add tutorial resources
  const tutorialsDir = join(docsDir, 'tutorials');
  try {
    const tutorials = readdirSync(tutorialsDir).filter(f => f.endsWith('.md')).sort();
    for (const file of tutorials) {
      const name = basename(file, '.md');
      staticResources.push({
        uri: `superdb://tutorials/${name}`,
        name: `Tutorial: ${name}`,
        description: `SuperDB tutorial: ${name}`,
        mimeType: 'text/markdown',
      });
    }
  } catch {
    // tutorials dir may not exist
  }

  // Add recipe resources
  const recipesDir = join(docsDir, 'recipes');
  try {
    const recipes = readdirSync(recipesDir).filter(f => f.endsWith('.spq')).sort();
    for (const file of recipes) {
      const name = basename(file, '.spq');
      staticResources.push({
        uri: `superdb://recipes/${name}`,
        name: `Recipe: ${name}`,
        description: `SuperDB recipe functions: ${name}`,
        mimeType: 'text/plain',
      });
    }
  } catch {
    // recipes dir may not exist
  }

  return staticResources;
}

const resources = buildResources();

// Tool definitions — grouped by category, ordered by likely usage frequency
const tools = [
  // --- Query & Data ---
  {
    name: 'super_query',
    description: 'Execute a SuperDB/SuperSQL query on data files. Returns structured results without shell escaping issues.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The SuperSQL query to execute',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths for pipeline-style input (piped into the query). For SQL FROM clauses, use absolute paths directly in the query instead.',
        },
        data: {
          type: 'string',
          description: 'Inline data to query (alternative to files)',
        },
        format: {
          type: 'string',
          enum: ['json', 'sup', 'csv', 'table'],
          description: 'Output format (default: json)',
        },
        inputFormat: {
          type: 'string',
          description: 'Force input format if auto-detection fails',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'super_schema',
    description: 'Inspect the schema/types of a data file by finding all unique shapes (record types) with counts and examples.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file: {
          type: 'string',
          description: 'Path to the data file',
        },
      },
      required: ['file'],
    },
  },
  // --- Database (Lake) ---
  {
    name: 'super_db_query',
    description: 'Query data from a SuperDB database pool.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The SuperSQL query to execute',
        },
        pool: {
          type: 'string',
          description: 'Pool name (can also use FROM in query)',
        },
        lake: {
          type: 'string',
          description: 'Lake path (default: uses SUPER_DB_LAKE env or ~/.super)',
        },
        format: {
          type: 'string',
          enum: ['json', 'sup', 'csv', 'table'],
          description: 'Output format (default: json)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'super_db_list',
    description: 'List all pools in a SuperDB database.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        lake: {
          type: 'string',
          description: 'Lake path (default: uses SUPER_DB_LAKE env or ~/.super)',
        },
      },
    },
  },
  {
    name: 'super_db_create_pool',
    description: 'Create a new pool in a SuperDB database.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name for the new pool',
        },
        orderBy: {
          type: 'string',
          description: 'Field to order/sort data by',
        },
        lake: {
          type: 'string',
          description: 'Lake path (default: uses SUPER_DB_LAKE env or ~/.super)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'super_db_load',
    description: 'Load data into a SuperDB database pool.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        pool: {
          type: 'string',
          description: 'Pool name to load data into',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths to load',
        },
        data: {
          type: 'string',
          description: 'Inline data to load (alternative to files)',
        },
        lake: {
          type: 'string',
          description: 'Lake path (default: uses SUPER_DB_LAKE env or ~/.super)',
        },
      },
      required: ['pool'],
    },
  },
  // --- Documentation & Reference ---
  {
    name: 'super_help',
    description: 'Get SuperDB documentation (content targets v0.1.0). Call this before writing complex queries or when migrating from zq or earlier versions of SuperDB. Topics: expert (overview + section index), expert:<section> (e.g. expert:sql, expert:aggregates), expert:all (full document), upgrade (zq migration), tutorials (list tutorials), tutorial:<name> (read a specific tutorial). Call super_info to check your installed version.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          description: 'Documentation topic to retrieve',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'super_grok_patterns',
    description: 'Search/filter grok patterns by name or regex content (content targets SuperDB v0.1.0). Returns matching patterns as JSON array of {pattern_name, regex} objects. No query returns all patterns.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Optional filter — matches against pattern name or regex content (case-insensitive substring)',
        },
      },
    },
  },
  {
    name: 'super_recipes',
    description: 'Search/list available SuperDB recipe functions from the superkit collection (content targets SuperDB v0.1.0). Returns structured JSON with function signatures, descriptions, and usage examples.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Optional filter — matches against function name, description, or source file (case-insensitive substring)',
        },
      },
    },
  },
  // --- Environment & Diagnostics ---
  {
    name: 'super_info',
    description: 'Get SuperDB version info, environment configuration, LSP availability, and installation instructions. Call this to check setup status or learn how to install the optional LSP for enhanced query assistance.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        compare_to: {
          type: 'string',
          description: 'Optional path to another super binary to compare versions',
        },
      },
    },
  },
  {
    name: 'super_lsp_status',
    description: 'Check if the SuperDB LSP is installed and get installation instructions if not. The LSP enables code completions and documentation lookup for SuperSQL queries.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'super_test_compat',
    description: 'Test a query against multiple SuperDB versions to detect syntax breaking changes. Useful for migration testing.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The SuperSQL query to test',
        },
        versions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Paths to different super binaries to test against',
        },
      },
      required: ['query', 'versions'],
    },
  },
  // --- LSP (requires SUPERDB_LSP_PATH) ---
  {
    name: 'super_complete',
    description: 'Get code completions for a SuperSQL query at a position. Requires SUPERDB_LSP_PATH to be set.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The SuperSQL query text',
        },
        line: {
          type: 'number',
          description: 'Line number (0-based)',
        },
        character: {
          type: 'number',
          description: 'Character offset (0-based)',
        },
      },
      required: ['query', 'line', 'character'],
    },
  },
  {
    name: 'super_docs',
    description: 'Get documentation for a symbol at a position in a SuperSQL query. Requires SUPERDB_LSP_PATH to be set.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The SuperSQL query text',
        },
        line: {
          type: 'number',
          description: 'Line number (0-based)',
        },
        character: {
          type: 'number',
          description: 'Character offset (0-based)',
        },
      },
      required: ['query', 'line', 'character'],
    },
  },
  ];

// Register resource list handler
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources,
}));

// Register resource read handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  const staticMap: Record<string, string> = {
    'superdb://docs/expert': 'superdb-expert.md',
    'superdb://docs/upgrade-guide': 'zq-to-super-upgrades.md',
    'superdb://docs/grok-patterns': 'grok-patterns.sup',
  };

  let filepath: string | null = null;
  let mimeType = 'text/markdown';

  if (staticMap[uri]) {
    filepath = join(docsDir, staticMap[uri]);
    if (uri.endsWith('grok-patterns')) mimeType = 'text/plain';
  } else if (uri.startsWith('superdb://tutorials/')) {
    const name = uri.slice('superdb://tutorials/'.length);
    filepath = join(docsDir, 'tutorials', `${name}.md`);
  } else if (uri.startsWith('superdb://recipes/')) {
    const name = uri.slice('superdb://recipes/'.length);
    filepath = join(docsDir, 'recipes', `${name}.spq`);
    mimeType = 'text/plain';
  }

  if (!filepath) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  try {
    const content = readFileSync(filepath, 'utf-8');
    return {
      contents: [
        {
          uri,
          mimeType,
          text: content,
        },
      ],
    };
  } catch (error) {
    throw new Error(`Failed to read resource: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'super_query': {
        const result = await superQuery({
          query: args?.query as string,
          files: args?.files as string[] | undefined,
          data: args?.data as string | undefined,
          format: args?.format as 'json' | 'sup' | 'csv' | 'table' | undefined,
          inputFormat: args?.inputFormat as string | undefined,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_schema': {
        const result = await superSchema(args?.file as string);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_db_list': {
        const result = await superDbList(args?.lake as string | undefined);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_db_query': {
        const result = await superDbQuery({
          query: args?.query as string,
          pool: args?.pool as string | undefined,
          lake: args?.lake as string | undefined,
          format: args?.format as 'json' | 'sup' | 'csv' | 'table' | undefined,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_db_load': {
        const result = await superDbLoad({
          pool: args?.pool as string,
          files: args?.files as string[] | undefined,
          data: args?.data as string | undefined,
          lake: args?.lake as string | undefined,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_db_create_pool': {
        const result = await superDbCreatePool({
          name: args?.name as string,
          orderBy: args?.orderBy as string | undefined,
          lake: args?.lake as string | undefined,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_info': {
        const result = superInfo(args?.compare_to as string | undefined);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_lsp_status': {
        const result = superLspStatus();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_help': {
        const result = superHelp(args?.topic as string);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_test_compat': {
        const result = await superTestCompat(
          args?.query as string,
          args?.versions as string[]
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_complete': {
        const result = await superComplete(
          args?.query as string,
          args?.line as number,
          args?.character as number
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_docs': {
        const result = await superDocs(
          args?.query as string,
          args?.line as number,
          args?.character as number
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_grok_patterns': {
        const result = superGrokPatterns(args?.query as string | undefined);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'super_recipes': {
        const result = superRecipes(args?.query as string | undefined);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SuperDB MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
