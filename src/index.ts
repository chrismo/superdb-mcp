#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { superQuery, superValidate, superSchema } from './tools/query.js';
import { superDbList, superDbQuery, superDbLoad, superDbCreatePool } from './tools/db.js';
import { superInfo, superCompare, superHelp, superTestCompat, superLspStatus } from './tools/info.js';
import { superComplete, superDocs, getLspStatus } from './tools/lsp.js';

// Get docs directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const docsDir = join(__dirname, '../docs');

const server = new Server(
  {
    name: 'superdb-mcp',
    version: '0.51231.3',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Resource definitions
const resources = [
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
];

// Tool definitions
const tools = [
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
    name: 'super_help',
    description: 'Get SuperDB documentation. Call this before writing complex queries or when migrating from zq or earlier versions of SuperDB. Topics: expert (syntax guide), upgrade (zq migration).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          enum: ['expert', 'upgrade', 'upgrade-guide', 'migration'],
          description: 'Documentation topic to retrieve',
        },
      },
      required: ['topic'],
    },
  },
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
          description: 'File paths to query (JSON, Parquet, CSV, SUP, etc.)',
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
    name: 'super_validate',
    description: 'Validate SuperSQL query syntax without executing. Returns diagnostics with position info and migration suggestions for common zq-to-SuperDB errors.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The SuperSQL query to validate',
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

  const resourceMap: Record<string, string> = {
    'superdb://docs/expert': 'superdb-expert.md',
    'superdb://docs/upgrade-guide': 'zq-to-super-upgrades.md',
  };

  const filename = resourceMap[uri];
  if (!filename) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  try {
    const filepath = join(docsDir, filename);
    const content = readFileSync(filepath, 'utf-8');
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
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

      case 'super_validate': {
        const result = await superValidate(args?.query as string);
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
