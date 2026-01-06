import { spawn, spawnSync, ChildProcess } from 'child_process';

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
    const result = spawnSync(lspPath, ['--help'], {
      timeout: 2000,
      encoding: 'utf-8',
    });

    // LSP servers typically don't have --help, they just wait for stdin
    // So we consider it available if it starts without immediate error
    if (result.error) {
      return {
        available: false,
        path: lspPath,
        error: `LSP server at ${lspPath} failed to start: ${result.error.message}`,
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
 * Simple LSP client that spawns the server for each operation.
 * Sends all messages (initialize, didOpen, request) in a single session.
 */
export class LSPClient {
  private lspPath: string;
  private timeout: number;

  constructor(options: LSPClientOptions = {}) {
    const path = options.lspPath || getLspPath();
    if (!path) {
      throw new Error('LSP path not configured. Set SUPERDB_LSP_PATH environment variable.');
    }
    this.lspPath = path;
    this.timeout = options.timeout || 5000;
  }

  /**
   * Format a JSON-RPC message with Content-Length header
   */
  private formatMessage(message: Omit<LSPMessage, 'jsonrpc'> & { jsonrpc?: '2.0' }): string {
    const content = JSON.stringify({ jsonrpc: '2.0', ...message });
    return `Content-Length: ${content.length}\r\n\r\n${content}`;
  }

  /**
   * Parse LSP messages from stdout buffer
   */
  private parseMessages(buffer: string): LSPMessage[] {
    const messages: LSPMessage[] = [];
    let remaining = buffer;

    while (remaining.length > 0) {
      const headerMatch = remaining.match(/^Content-Length: (\d+)\r\n\r\n/);
      if (!headerMatch) break;

      const contentLength = parseInt(headerMatch[1]);
      const headerLength = headerMatch[0].length;

      if (remaining.length < headerLength + contentLength) break;

      const body = remaining.slice(headerLength, headerLength + contentLength);
      try {
        messages.push(JSON.parse(body) as LSPMessage);
      } catch {
        // Skip malformed messages
      }
      remaining = remaining.slice(headerLength + contentLength);
    }

    return messages;
  }

  /**
   * Execute a full LSP session: initialize, open document, send request, get response
   */
  private async executeSession(
    query: string,
    requestMethod: string,
    requestParams: unknown
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.lspPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;
      let messageId = 0;
      const finalRequestId = 3; // initialize=1, didOpen=notification, request=3

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill();
          reject(new Error(`LSP request timed out after ${this.timeout}ms`));
        }
      }, this.timeout);

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();

        // Parse all complete messages
        const messages = this.parseMessages(stdout);

        for (const msg of messages) {
          // Look for our final request response
          if (msg.id === finalRequestId) {
            clearTimeout(timeoutId);
            resolved = true;
            proc.kill();
            if (msg.error) {
              reject(new Error(msg.error.message));
            } else {
              resolve(msg.result);
            }
            return;
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
          // If we haven't got a response yet, treat as error
          reject(new Error(`LSP process exited with code ${code} before responding: ${stderr}`));
        }
      });

      const uri = 'file:///virtual/query.spq';

      // Send all messages in sequence
      // 1. Initialize request
      messageId++;
      proc.stdin.write(this.formatMessage({
        id: messageId,
        method: 'initialize',
        params: {
          processId: process.pid,
          capabilities: {},
          rootUri: null,
        },
      }));

      // 2. Initialized notification (no id)
      proc.stdin.write(this.formatMessage({
        method: 'initialized',
        params: {},
      }));

      // 3. Open document notification (no id)
      proc.stdin.write(this.formatMessage({
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId: 'spq',
            version: 1,
            text: query,
          },
        },
      }));

      // 4. The actual request
      messageId = finalRequestId;
      proc.stdin.write(this.formatMessage({
        id: messageId,
        method: requestMethod,
        params: requestParams,
      }));
    });
  }

  /**
   * Get completions at a position in a query
   */
  async getCompletions(query: string, line: number, character: number): Promise<CompletionItem[]> {
    try {
      const uri = 'file:///virtual/query.spq';
      const result = await this.executeSession(query, 'textDocument/completion', {
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
      const result = await this.executeSession(query, 'textDocument/hover', {
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
