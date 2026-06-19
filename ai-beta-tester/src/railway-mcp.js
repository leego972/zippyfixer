/**
 * ZippyFixer — Railway MCP Client
 *
 * Ported from BridgeAI (leego972/bridge-ai) railwayMcp.ts
 *
 * Connects to Railway's official MCP server at https://railway.com/mcp
 * using JSON-RPC 2.0 over streamable HTTP (MCP protocol 2024-11-05).
 *
 * Auto-discovers ALL Railway tools via tools/list — no hardcoded queries needed.
 * The AI gets every Railway capability: deployments, logs, env vars, rollbacks,
 * service management, project config, and more.
 */

class RailwayMcpClient {
  constructor(token, baseUrl = 'https://railway.com/mcp') {
    this.token = token;
    this.baseUrl = baseUrl;
    this.sessionId = null;
    this.toolsCache = null;
    this.initialized = false;
    this.reqId = 1;
  }

  _nextId() { return this.reqId++; }

  _buildHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${this.token}`,
    };
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
    return headers;
  }

  /** Parse MCP streamable HTTP response — handles both JSON and SSE. */
  async _parseResponse(res) {
    const sessionHeader = res.headers.get('mcp-session-id');
    if (sessionHeader) this.sessionId = sessionHeader;

    const ct = res.headers.get('content-type') || '';
    const text = await res.text();

    if (ct.includes('text/event-stream')) {
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          try { return JSON.parse(line.slice(6)); } catch { /* skip */ }
        }
      }
      return null;
    }

    if (!text.trim()) return null;
    return JSON.parse(text);
  }

  async _post(method, params = {}) {
    const id = this._nextId();
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this._buildHeaders(),
      body,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Railway MCP HTTP ${res.status}: ${errText}`);
    }

    const parsed = await this._parseResponse(res);
    if (!parsed) return null;
    if (parsed.error) throw new Error(`Railway MCP [${parsed.error.code}]: ${parsed.error.message}`);
    return parsed.result;
  }

  /** Establish MCP session (called automatically before first use). */
  async initialize() {
    if (this.initialized) return;
    await this._post('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'zippyfixer-mcp', version: '1.0.0' },
    });
    this.initialized = true;
    console.log(`[Railway MCP] Session initialized (id: ${this.sessionId || 'none'})`);
  }

  /** List all tools exposed by the Railway MCP server (cached). */
  async listTools() {
    if (this.toolsCache) return this.toolsCache;
    if (!this.initialized) await this.initialize();
    const result = await this._post('tools/list');
    this.toolsCache = result?.tools || [];
    console.log(`[Railway MCP] ${this.toolsCache.length} tools loaded`);
    return this.toolsCache;
  }

  /** Execute a Railway MCP tool by name. */
  async callTool(name, args = {}) {
    if (!this.initialized) await this.initialize();
    try {
      const result = await this._post('tools/call', { name, arguments: args });
      return result || { content: [{ type: 'text', text: 'No result returned.' }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Railway tool "${name}" failed: ${err.message}` }],
        isError: true,
      };
    }
  }

  clearCache() { this.toolsCache = null; }
}

/** Singleton per token */
const clients = new Map();

function getRailwayMcpClient(token) {
  const t = token || process.env.RAILWAY_TOKEN || '';
  if (!t) return null;
  if (!clients.has(t)) clients.set(t, new RailwayMcpClient(t));
  return clients.get(t);
}

/** Convert MCP tool definitions to OpenAI-compatible function schemas */
function mcpToolsToOpenAiFunctions(tools) {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: `railway_${t.name}`,
      description: t.description,
      parameters: t.inputSchema || { type: 'object', properties: {} },
    },
  }));
}

module.exports = { RailwayMcpClient, getRailwayMcpClient, mcpToolsToOpenAiFunctions };
