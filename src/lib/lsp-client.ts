import { spawn, ChildProcess } from 'child_process';

/**
 * LSP message types
 */
interface LSPMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface Position {
  line: number;
  character: number;
}

interface CompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | { kind: string; value: string };
  insertText?: string;
}

interface Diagnostic {
  range: {
    start: Position;
    end: Position;
  };
  severity?: number;
  message: string;
  source?: string;
}

interface HoverResult {
  contents: string | { kind: string; value: string };
  range?: {
    start: Position;
    end: Position;
  };
}

export interface LSPClientOptions {
  lspPath?: string;
  timeout?: number;
}

export interface LSPAvailability {
  available: boolean;
  path: string | null;
  error: string | null;
}

/**
 * Get the path to the LSP server
 */
export function getLspPath(): string | null {
  return process.env.SUPERDB_LSP_PATH || null;
}

/**
 * Check if the LSP server is available
 */
export function checkLspAvailability(): LSPAvailability {
  const lspPath = getLspPath();

  if (!lspPath) {
    return {
      available: false,
      path: null,
      error: 'SUPERDB_LSP_PATH environment variable not set. Install superdb-lsp for enhanced features.',
    };
  }

  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync(lspPath, ['--help'], {
      timeout: 2000,
      encoding: 'utf-8',
    });

    if (result.error || result.status !== 0) {
      return {
        available: false,
        path: lspPath,
        error: `LSP server at ${lspPath} is not working: ${result.error?.message || 'unknown error'}`,
      };
    }

    return {
      available: true,
      path: lspPath,
      error: null,
    };
  } catch (e) {
    return {
      available: false,
      path: lspPath,
      error: `Failed to check LSP: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Simple LSP client that spawns the server, sends a request, and gets a response
 * Uses a fresh process per request for simplicity
 */
export class LSPClient {
  private lspPath: string;
  private timeout: number;
  private messageId: number = 0;

  constructor(options: LSPClientOptions = {}) {
    const path = options.lspPath || getLspPath();
    if (!path) {
      throw new Error('LSP path not configured. Set SUPERDB_LSP_PATH environment variable.');
    }
    this.lspPath = path;
    this.timeout = options.timeout || 5000;
  }

  /**
   * Send a request to the LSP and get a response
   */
  private async sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.lspPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill();
          reject(new Error(`LSP request timed out after ${this.timeout}ms`));
        }
      }, this.timeout);

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();

        // Try to parse response
        const match = stdout.match(/Content-Length: (\d+)\r\n\r\n([\s\S]*)/);
        if (match) {
          const contentLength = parseInt(match[1]);
          const body = match[2];
          if (body.length >= contentLength) {
            try {
              const response = JSON.parse(body.slice(0, contentLength)) as LSPMessage;
              if (response.id === this.messageId) {
                clearTimeout(timeoutId);
                resolved = true;
                proc.kill();
                if (response.error) {
                  reject(new Error(response.error.message));
                } else {
                  resolve(response.result);
                }
              }
            } catch {
              // Continue reading
            }
          }
        }
      });

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => {
        if (!resolved) {
          clearTimeout(timeoutId);
          resolved = true;
          reject(new Error(`LSP process error: ${err.message}`));
        }
      });

      proc.on('close', (code) => {
        if (!resolved) {
          clearTimeout(timeoutId);
          resolved = true;
          if (code !== 0) {
            reject(new Error(`LSP process exited with code ${code}: ${stderr}`));
          }
        }
      });

      // Send initialize request first
      this.messageId++;
      const initMessage = this.formatMessage({
        jsonrpc: '2.0',
        id: this.messageId,
        method: 'initialize',
        params: {
          processId: process.pid,
          capabilities: {},
          rootUri: null,
        },
      });
      proc.stdin.write(initMessage);

      // Wait a bit then send the actual request
      setTimeout(() => {
        // Send initialized notification
        const initializedMessage = this.formatMessage({
          jsonrpc: '2.0',
          method: 'initialized',
          params: {},
        });
        proc.stdin.write(initializedMessage);

        // Send the actual request
        this.messageId++;
        const requestMessage = this.formatMessage({
          jsonrpc: '2.0',
          id: this.messageId,
          method,
          params,
        });
        proc.stdin.write(requestMessage);
      }, 100);
    });
  }

  /**
   * Format a JSON-RPC message with Content-Length header
   */
  private formatMessage(message: LSPMessage): string {
    const content = JSON.stringify(message);
    return `Content-Length: ${content.length}\r\n\r\n${content}`;
  }

  /**
   * Get completions at a position in a query
   */
  async getCompletions(query: string, line: number, character: number): Promise<CompletionItem[]> {
    try {
      // Create a virtual document
      const uri = 'file:///virtual/query.spq';

      // Open the document
      await this.sendRequest('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'spq',
          version: 1,
          text: query,
        },
      });

      // Request completions
      const result = await this.sendRequest('textDocument/completion', {
        textDocument: { uri },
        position: { line, character },
      });

      if (Array.isArray(result)) {
        return result as CompletionItem[];
      }
      if (result && typeof result === 'object' && 'items' in result) {
        return (result as { items: CompletionItem[] }).items;
      }
      return [];
    } catch (e) {
      console.error('LSP completion error:', e);
      return [];
    }
  }

  /**
   * Get hover documentation at a position
   */
  async getHover(query: string, line: number, character: number): Promise<HoverResult | null> {
    try {
      const uri = 'file:///virtual/query.spq';

      await this.sendRequest('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'spq',
          version: 1,
          text: query,
        },
      });

      const result = await this.sendRequest('textDocument/hover', {
        textDocument: { uri },
        position: { line, character },
      });

      return result as HoverResult | null;
    } catch (e) {
      console.error('LSP hover error:', e);
      return null;
    }
  }

  /**
   * Get diagnostics for a query
   */
  async getDiagnostics(query: string): Promise<Diagnostic[]> {
    // The LSP sends diagnostics via notifications after didOpen
    // For now, we use super compile for validation
    // This is a placeholder for future LSP diagnostic support
    return [];
  }
}

/**
 * Singleton instance with lazy initialization
 */
let lspClient: LSPClient | null = null;
let lspCheckDone = false;
let lspAvailable = false;

/**
 * Get the LSP client, or null if not available
 */
export function getLspClient(): LSPClient | null {
  if (!lspCheckDone) {
    const availability = checkLspAvailability();
    lspAvailable = availability.available;
    lspCheckDone = true;
  }

  if (!lspAvailable) {
    return null;
  }

  if (!lspClient) {
    try {
      lspClient = new LSPClient();
    } catch {
      lspAvailable = false;
      return null;
    }
  }

  return lspClient;
}
