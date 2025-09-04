#!/usr/bin/env node
/**
 * Claude Buddy WebSocket Client
 * Connect and interact with Claude Buddy server
 */

const WebSocket = require('ws');
const readline = require('readline');

class ClaudeBuddyClient {
  constructor(url = 'ws://localhost:8080') {
    this.url = url;
    this.ws = null;
    this.clientId = null;
    this.reconnectInterval = 5000;
    this.shouldReconnect = true;
    this.messageHandlers = new Map();
  }

  connect() {
    console.log(`Connecting to ${this.url}...`);
    
    this.ws = new WebSocket(this.url);
    
    this.ws.on('open', () => {
      console.log('✓ Connected to Claude Buddy server');
      this.setupPing();
    });
    
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });
    
    this.ws.on('close', () => {
      console.log('Connection closed');
      if (this.shouldReconnect) {
        console.log(`Reconnecting in ${this.reconnectInterval / 1000} seconds...`);
        setTimeout(() => this.connect(), this.reconnectInterval);
      }
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });
  }

  handleMessage(message) {
    // Handle specific message types
    switch (message.type) {
      case 'welcome':
        this.clientId = message.clientId;
        console.log(`Assigned client ID: ${this.clientId}`);
        console.log(message.message);
        break;
        
      case 'pong':
        // Ping response received
        break;
        
      case 'broadcast':
        console.log(`[Broadcast from ${message.from}]: ${message.content}`);
        break;
        
      case 'server_broadcast':
        console.log(`[Server]: ${message.message}`);
        break;
        
      case 'client_connected':
        console.log(`New client connected (Total: ${message.totalClients})`);
        break;
        
      case 'client_disconnected':
        console.log(`Client disconnected (Total: ${message.totalClients})`);
        break;
        
      case 'claude_response':
        console.log(`[Claude Response]: ${message.response}`);
        break;
        
      case 'query_result':
        console.log('Query Result:', JSON.stringify(message.data, null, 2));
        break;
        
      case 'error':
        console.error(`[Error]: ${message.message}`);
        break;
        
      default:
        console.log('Received:', message);
    }
    
    // Call custom handlers if registered
    if (this.messageHandlers.has(message.type)) {
      this.messageHandlers.get(message.type)(message);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  setupPing() {
    setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000); // Ping every 30 seconds
  }

  // Utility methods
  broadcast(message) {
    this.send({
      type: 'broadcast',
      content: message
    });
  }

  query(sql) {
    this.send({
      type: 'query',
      query: sql
    });
  }

  requestClaude(prompt, requestId = Date.now()) {
    this.send({
      type: 'claude_request',
      prompt,
      request_id: requestId
    });
  }

  setName(name) {
    this.send({
      type: 'set_name',
      name
    });
  }

  on(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  close() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Interactive CLI client
function startInteractiveClient() {
  const client = new ClaudeBuddyClient();
  client.connect();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'claude-buddy> '
  });
  
  console.log(`
Claude Buddy WebSocket Client
Commands:
  /broadcast <message>  - Broadcast message to all clients
  /query <sql>         - Execute SQL query
  /claude <prompt>     - Send request to Claude
  /name <name>         - Set your client name
  /status              - Get server status
  /quit                - Exit client
  `);
  
  setTimeout(() => rl.prompt(), 1000);
  
  rl.on('line', (line) => {
    const input = line.trim();
    
    if (input.startsWith('/')) {
      const [command, ...args] = input.slice(1).split(' ');
      const argument = args.join(' ');
      
      switch (command) {
        case 'broadcast':
          client.broadcast(argument);
          break;
          
        case 'query':
          client.query(argument);
          break;
          
        case 'claude':
          client.requestClaude(argument);
          break;
          
        case 'name':
          client.setName(argument);
          console.log(`Name set to: ${argument}`);
          break;
          
        case 'status':
          fetch('http://localhost:8080/status')
            .then(res => res.json())
            .then(data => console.log('Server Status:', data))
            .catch(err => console.error('Failed to get status:', err.message));
          break;
          
        case 'quit':
          client.close();
          process.exit(0);
          break;
          
        default:
          console.log(`Unknown command: ${command}`);
      }
    } else if (input) {
      // Send as regular broadcast
      client.broadcast(input);
    }
    
    rl.prompt();
  });
  
  rl.on('close', () => {
    client.close();
    process.exit(0);
  });
}

// Export for programmatic use
module.exports = ClaudeBuddyClient;

// Run interactive client if executed directly
if (require.main === module) {
  startInteractiveClient();
}