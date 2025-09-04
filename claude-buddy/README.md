# Claude Buddy WebSocket System

Real-time communication hub for Claude integrations with WebSocket support, notifications, and MCP server compatibility.

## Features

🔌 **WebSocket Server** - Real-time bidirectional communication  
📊 **SQLite Integration** - Persistent message and event storage  
🔔 **Notification System** - Monitor files, system resources, and GitHub  
⚡ **MCP Compatible** - Integrated with Claude Code MCP servers  
🌐 **REST API** - HTTP endpoints for status and control  
👥 **Multi-client Support** - Handle multiple simultaneous connections  

## Quick Start

```bash
# Install dependencies
npm install

# Start the WebSocket server
npm start

# Start notifications (in another terminal)
npm run notifications

# Connect a client (in another terminal)
npm run client
```

## Architecture

```
┌─────────────────────┐    ┌─────────────────────┐
│   Claude Code       │    │   WebSocket         │
│   MCP Integration   │◄──►│   Server            │
│                     │    │   (port 8080)       │
└─────────────────────┘    └─────────────────────┘
                                      ▲
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
            ┌───────▼─────────┐ ┌─────▼─────┐ ┌────────▼────────┐
            │  Notification   │ │  Client   │ │  Web Browser    │
            │  System         │ │  Apps     │ │  Dashboard      │
            └─────────────────┘ └───────────┘ └─────────────────┘
                    │
            ┌───────▼─────────┐
            │  SQLite         │
            │  Database       │
            │  (claude_buddy) │
            └─────────────────┘
```

## Components

### 1. WebSocket Server (`server.js`)
- Main WebSocket server on port 8080
- Handles client connections and message routing
- SQLite integration for persistence
- REST API endpoints

### 2. Client Library (`client.js`)
- Interactive CLI client
- Programmatic client class
- Support for commands and real-time messaging

### 3. Notification System (`notifications.js`)
- File system monitoring
- System resource monitoring
- GitHub event simulation
- MCP server health monitoring

### 4. MCP Integration (`mcp-websocket-server.js`)
- Claude Code MCP server compatibility
- WebSocket tools for Claude
- Database query capabilities

## Usage Examples

### Send WebSocket Messages from Claude

```bash
# Use Claude Code to send WebSocket messages
claude-code --print "Use claude-buddy-websocket to broadcast 'Hello World!'"
```

### Query WebSocket Database

```sql
-- Get recent messages
SELECT * FROM messages ORDER BY timestamp DESC LIMIT 10;

-- Get connection stats
SELECT COUNT(*) as total_connections FROM connections;

-- Get event history
SELECT event_type, COUNT(*) as count FROM events GROUP BY event_type;
```

### Interactive Client Commands

```
claude-buddy> /broadcast Hello everyone!
claude-buddy> /query SELECT * FROM messages LIMIT 5
claude-buddy> /name MyClient
claude-buddy> /status
```

## Database Schema

### Tables
- **messages** - All WebSocket messages
- **connections** - Client connection history  
- **events** - System events and notifications

### Sample Queries
```sql
-- Active connections
SELECT * FROM connections WHERE status = 'active';

-- Message types
SELECT type, COUNT(*) FROM messages GROUP BY type;

-- Recent events
SELECT * FROM events WHERE timestamp > datetime('now', '-1 hour');
```

## API Endpoints

- `GET /status` - Server status and metrics
- `GET /clients` - List connected clients
- `GET /events` - Recent events
- `GET /messages` - Recent messages
- `POST /broadcast` - Broadcast message to all clients

## Integration with Claude Code

The MCP server provides these tools to Claude:

- `websocket_send` - Send targeted messages
- `websocket_broadcast` - Broadcast to all clients
- `websocket_query` - Query database
- `websocket_status` - Get server status
- `websocket_clients` - List clients

## Development

```bash
# Start server and notifications together
npm run dev

# Test the system
npm test

# Start individual components
npm run start      # WebSocket server only
npm run client     # Interactive client
npm run notifications  # Notification system only
```

## Configuration

Environment variables:
- `PORT` - WebSocket server port (default: 8080)
- `DB_PATH` - SQLite database path

## Monitoring

The notification system automatically monitors:
- File changes in project directories
- System memory and disk usage
- GitHub events (simulated)
- MCP server health status

## Security Notes

- WebSocket server runs on localhost only
- No authentication implemented (local development)
- SQLite database stored locally
- All connections logged

---

Created for Daniel's Claude development environment  
Last updated: 2025-09-04