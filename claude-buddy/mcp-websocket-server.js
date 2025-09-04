#!/usr/bin/env node
/**
 * Claude Buddy MCP WebSocket Server
 * MCP-compatible server with WebSocket capabilities
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

class MCPWebSocketServer {
  constructor() {
    this.capabilities = {
      tools: {
        websocket_send: {
          description: "Send message via WebSocket",
          inputSchema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Message to send" },
              type: { type: "string", description: "Message type", default: "broadcast" },
              target: { type: "string", description: "Target client ID (optional)" }
            },
            required: ["message"]
          }
        },
        websocket_query: {
          description: "Query WebSocket server database",
          inputSchema: {
            type: "object",
            properties: {
              sql: { type: "string", description: "SQL query to execute" }
            },
            required: ["sql"]
          }
        },
        websocket_status: {
          description: "Get WebSocket server status",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false
          }
        },
        websocket_clients: {
          description: "List connected WebSocket clients",
          inputSchema: {
            type: "object", 
            properties: {},
            additionalProperties: false
          }
        },
        websocket_broadcast: {
          description: "Broadcast message to all WebSocket clients",
          inputSchema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Message to broadcast" },
              type: { type: "string", description: "Message type", default: "server_broadcast" }
            },
            required: ["message"]
          }
        }
      }
    };
    
    this.ws = null;
    this.isConnected = false;
    this.db = null;
  }

  async initialize() {
    // Connect to WebSocket server
    try {
      this.ws = new WebSocket('ws://localhost:8080');
      
      this.ws.on('open', () => {
        this.isConnected = true;
        this.ws.send(JSON.stringify({
          type: 'set_name',
          name: 'MCP-WebSocket-Server'
        }));
      });
      
      this.ws.on('close', () => {
        this.isConnected = false;
      });
      
      this.ws.on('error', (error) => {
        console.error('WebSocket connection error:', error.message);
      });
      
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error.message);
    }
    
    // Initialize database connection
    this.db = new sqlite3.Database('/Users/daniel/databases/claude_buddy.db');
    
    return {
      protocolVersion: "2024-11-05",
      capabilities: this.capabilities,
      serverInfo: {
        name: "claude-buddy-websocket",
        version: "1.0.0"
      }
    };
  }

  async handleToolCall(toolName, args) {
    switch (toolName) {
      case 'websocket_send':
        return this.sendWebSocketMessage(args);
        
      case 'websocket_query':
        return this.queryDatabase(args);
        
      case 'websocket_status':
        return this.getServerStatus();
        
      case 'websocket_clients':
        return this.getClients();
        
      case 'websocket_broadcast':
        return this.broadcastMessage(args);
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async sendWebSocketMessage(args) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }
    
    const message = {
      type: args.type || 'mcp_message',
      content: args.message,
      source: 'mcp-server',
      timestamp: new Date().toISOString()
    };
    
    if (args.target) {
      message.target = args.target;
    }
    
    this.ws.send(JSON.stringify(message));
    
    return {
      content: [{
        type: "text",
        text: `Message sent via WebSocket: ${args.message}`
      }]
    };
  }

  async queryDatabase(args) {
    return new Promise((resolve, reject) => {
      this.db.all(args.sql, (err, rows) => {
        if (err) {
          reject(new Error(`Database query failed: ${err.message}`));
        } else {
          resolve({
            content: [{
              type: "text",
              text: `Query executed successfully. Found ${rows.length} rows.\n\n${JSON.stringify(rows, null, 2)}`
            }]
          });
        }
      });
    });
  }

  async getServerStatus() {
    try {
      const response = await fetch('http://localhost:8080/status');
      const status = await response.json();
      
      return {
        content: [{
          type: "text",
          text: `WebSocket Server Status:\n${JSON.stringify(status, null, 2)}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get server status: ${error.message}`);
    }
  }

  async getClients() {
    try {
      const response = await fetch('http://localhost:8080/clients');
      const clients = await response.json();
      
      return {
        content: [{
          type: "text",
          text: `Connected Clients (${clients.length}):\n${JSON.stringify(clients, null, 2)}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get clients: ${error.message}`);
    }
  }

  async broadcastMessage(args) {
    try {
      const response = await fetch('http://localhost:8080/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: args.message,
          type: args.type
        })
      });
      
      const result = await response.json();
      
      return {
        content: [{
          type: "text",
          text: `Broadcast sent to ${result.clientsNotified} clients: ${args.message}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to broadcast message: ${error.message}`);
    }
  }
}

// MCP Protocol Handler
class MCPProtocolHandler {
  constructor() {
    this.server = new MCPWebSocketServer();
  }

  async handleRequest(request) {
    try {
      switch (request.method) {
        case 'initialize':
          return await this.server.initialize();
          
        case 'tools/list':
          return {
            tools: Object.entries(this.server.capabilities.tools).map(([name, tool]) => ({
              name,
              description: tool.description,
              inputSchema: tool.inputSchema
            }))
          };
          
        case 'tools/call':
          const result = await this.server.handleToolCall(request.params.name, request.params.arguments);
          return result;
          
        case 'ping':
          return { pong: true };
          
        default:
          throw new Error(`Unknown method: ${request.method}`);
      }
    } catch (error) {
      return {
        error: {
          code: -1,
          message: error.message
        }
      };
    }
  }

  async start() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.error('Claude Buddy MCP WebSocket Server started');
    
    // Process MCP requests
    for await (const line of rl) {
      try {
        if (!line.trim()) continue;
        
        const request = JSON.parse(line);
        const response = await this.handleRequest(request);
        
        const mcpResponse = {
          jsonrpc: "2.0",
          id: request.id,
          ...(response.error ? { error: response.error } : { result: response })
        };
        
        console.log(JSON.stringify(mcpResponse));
      } catch (error) {
        const errorResponse = {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: `Parse error: ${error.message}`
          }
        };
        console.log(JSON.stringify(errorResponse));
      }
    }
  }
}

// Start the MCP server
if (require.main === module) {
  const handler = new MCPProtocolHandler();
  handler.start().catch(console.error);
}

module.exports = { MCPWebSocketServer, MCPProtocolHandler };