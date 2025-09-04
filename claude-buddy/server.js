#!/usr/bin/env node
/**
 * Claude Buddy WebSocket Server
 * Real-time communication hub for Claude integrations
 */

const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Initialize SQLite database
const db = new sqlite3.Database('/Users/daniel/databases/claude_buddy.db');

// Create tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSON,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      client_name TEXT,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_ping DATETIME,
      status TEXT DEFAULT 'active'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      source TEXT,
      data JSON,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Store active connections
const clients = new Map();

// Broadcast message to all connected clients
function broadcast(message, excludeClient = null) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Log event to database
function logEvent(eventType, source, data) {
  db.run(
    'INSERT INTO events (event_type, source, data) VALUES (?, ?, ?)',
    [eventType, source, JSON.stringify(data)]
  );
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const clientId = Date.now().toString();
  const clientIp = req.socket.remoteAddress;
  
  console.log(`New client connected: ${clientId} from ${clientIp}`);
  
  // Store client info
  clients.set(clientId, {
    ws,
    name: `Client-${clientId}`,
    connectedAt: new Date()
  });
  
  // Add to database
  db.run(
    'INSERT INTO connections (id, client_name) VALUES (?, ?)',
    [clientId, `Client-${clientId}`]
  );
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId,
    message: 'Connected to Claude Buddy WebSocket Server',
    timestamp: new Date().toISOString()
  }));
  
  // Notify other clients
  broadcast({
    type: 'client_connected',
    clientId,
    totalClients: clients.size
  }, ws);
  
  logEvent('client_connected', clientId, { ip: clientIp });
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Received from ${clientId}:`, data);
      
      // Store message in database
      db.run(
        'INSERT INTO messages (type, content, metadata) VALUES (?, ?, ?)',
        [data.type || 'message', data.content || '', JSON.stringify(data.metadata || {})]
      );
      
      // Handle different message types
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          db.run('UPDATE connections SET last_ping = CURRENT_TIMESTAMP WHERE id = ?', [clientId]);
          break;
          
        case 'broadcast':
          broadcast({
            type: 'broadcast',
            from: clientId,
            content: data.content,
            timestamp: new Date().toISOString()
          }, ws);
          break;
          
        case 'query':
          handleQuery(ws, data.query);
          break;
          
        case 'claude_request':
          handleClaudeRequest(ws, data);
          break;
          
        case 'set_name':
          const client = clients.get(clientId);
          if (client) {
            client.name = data.name;
            db.run('UPDATE connections SET client_name = ? WHERE id = ?', [data.name, clientId]);
            ws.send(JSON.stringify({ type: 'name_updated', name: data.name }));
          }
          break;
          
        case 'run_ai_analysis':
          runAIAnalysis(ws, data.projectPath || process.cwd());
          break;
          
        case 'get_analysis_results':
          getAnalysisResults(ws);
          break;
          
        default:
          // Echo unknown messages with metadata
          ws.send(JSON.stringify({
            type: 'echo',
            original: data,
            timestamp: new Date().toISOString()
          }));
      }
      
      logEvent('message_received', clientId, data);
      
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        error: error.message
      }));
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    clients.delete(clientId);
    
    db.run('UPDATE connections SET status = ? WHERE id = ?', ['disconnected', clientId]);
    
    broadcast({
      type: 'client_disconnected',
      clientId,
      totalClients: clients.size
    });
    
    logEvent('client_disconnected', clientId, {});
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
    logEvent('websocket_error', clientId, { error: error.message });
  });
});

// Handle database queries
function handleQuery(ws, query) {
  db.all(query, (err, rows) => {
    if (err) {
      ws.send(JSON.stringify({
        type: 'query_error',
        error: err.message
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'query_result',
        data: rows
      }));
    }
  });
}

// Handle Claude-specific requests
function handleClaudeRequest(ws, data) {
  // This would integrate with Claude's API
  // For now, we'll simulate a response
  setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'claude_response',
      request_id: data.request_id,
      response: `Processed Claude request: ${data.prompt}`,
      timestamp: new Date().toISOString()
    }));
  }, 1000);
}

// Run AI analysis on project
function runAIAnalysis(ws, projectPath) {
  ws.send(JSON.stringify({
    type: 'analysis_started',
    message: 'Starting AI code analysis...',
    timestamp: new Date().toISOString()
  }));
  
  const { execSync } = require('child_process');
  
  try {
    // Change to the autonomous system directory and run analysis
    const analysisPath = '/Users/daniel/claude-autonomous-system';
    const command = `cd "${analysisPath}" && node ai-analysis.js`;
    
    execSync(command, { 
      cwd: projectPath,
      timeout: 30000 // 30 second timeout
    });
    
    // Try to read the results
    getAnalysisResults(ws);
    
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'analysis_error',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  }
}

// Get latest AI analysis results
function getAnalysisResults(ws) {
  try {
    const resultsFile = '/Users/daniel/claude-autonomous-system/ai-analysis-results.json';
    
    if (fs.existsSync(resultsFile)) {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      
      ws.send(JSON.stringify({
        type: 'analysis_results',
        data: results,
        timestamp: new Date().toISOString()
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'analysis_not_found',
        message: 'No analysis results found. Run analysis first.',
        timestamp: new Date().toISOString()
      }));
    }
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'analysis_error',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  }
}

// REST API endpoints
app.get('/status', (req, res) => {
  res.json({
    server: 'Claude Buddy WebSocket Server',
    clients: clients.size,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.get('/clients', (req, res) => {
  const clientList = Array.from(clients.entries()).map(([id, client]) => ({
    id,
    name: client.name,
    connectedAt: client.connectedAt
  }));
  res.json(clientList);
});

app.get('/events', (req, res) => {
  db.all('SELECT * FROM events ORDER BY timestamp DESC LIMIT 100', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.get('/messages', (req, res) => {
  db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Broadcast endpoint
app.post('/broadcast', (req, res) => {
  const { message } = req.body;
  broadcast({
    type: 'server_broadcast',
    message,
    timestamp: new Date().toISOString()
  });
  res.json({ success: true, clientsNotified: clients.size });
});

// AI Analysis endpoints
app.get('/analysis', (req, res) => {
  try {
    const resultsFile = '/Users/daniel/claude-autonomous-system/ai-analysis-results.json';
    
    if (fs.existsSync(resultsFile)) {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      res.json(results);
    } else {
      res.status(404).json({ error: 'No analysis results found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/analysis/run', (req, res) => {
  const { execSync } = require('child_process');
  
  try {
    const analysisPath = '/Users/daniel/claude-autonomous-system';
    const command = `cd "${analysisPath}" && node ai-analysis.js`;
    
    execSync(command, { timeout: 30000 });
    
    res.json({ 
      success: true, 
      message: 'Analysis completed',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   Claude Buddy WebSocket Server        ║
╠════════════════════════════════════════╣
║   WebSocket: ws://localhost:${PORT}       ║
║   REST API:  http://localhost:${PORT}     ║
║   Database:  claude_buddy.db           ║
╚════════════════════════════════════════╝
  `);
});