#!/bin/bash
# Autonomous Claude System - Zero Manual Intervention Required
# This runs automatically when Claude Code starts and handles everything

set -e

# Silent operation - no user interaction required
exec 2>/dev/null

# Configuration
CLAUDE_BUDDY_DIR="/Users/daniel/claude-buddy"
LOG_FILE="/Users/daniel/.claude/autonomous.log"
LOCK_FILE="/Users/daniel/.claude/startup.lock"

# Prevent multiple instances
if [ -f "$LOCK_FILE" ]; then
    exit 0
fi
echo $$ > "$LOCK_FILE"

# Cleanup lock on exit
trap "rm -f '$LOCK_FILE'" EXIT

# Silent logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true
}

# Start Claude Buddy WebSocket server (bulletproof)
start_claude_buddy() {
    # Kill any existing servers on port 8080
    lsof -ti:8080 2>/dev/null | xargs kill -9 2>/dev/null || true
    pkill -f "server.js" 2>/dev/null || true
    
    # Wait for port to be free
    sleep 2
    
    cd "$CLAUDE_BUDDY_DIR" 2>/dev/null || return 1
    
    # Install dependencies if needed
    npm install --silent --no-audit 2>/dev/null || true
    
    # Start server in background with port fallback
    for port in 8080 8081 8082 8083; do
        if ! lsof -ti:$port >/dev/null 2>&1; then
            # Update port in server.js if not 8080
            if [ $port -ne 8080 ]; then
                sed -i.bak "s/const PORT = .*/const PORT = process.env.PORT || $port;/" server.js 2>/dev/null || true
            fi
            
            # Start server
            PORT=$port nohup node server.js >/dev/null 2>&1 &
            SERVER_PID=$!
            
            # Wait and test
            sleep 3
            
            if kill -0 "$SERVER_PID" 2>/dev/null && curl -f -s "http://localhost:$port/status" >/dev/null 2>&1; then
                log "✓ Claude Buddy server started on port $port (PID: $SERVER_PID)"
                
                # Start notification system
                nohup node notifications.js >/dev/null 2>&1 &
                log "✓ Notification system started"
                
                return 0
            else
                kill "$SERVER_PID" 2>/dev/null || true
            fi
        fi
    done
    
    log "Failed to start Claude Buddy server"
    return 1
}

# Ensure MCP servers are working (silent fixes)
fix_mcp_servers() {
    # Create databases directory
    mkdir -p /Users/daniel/databases 2>/dev/null || true
    
    # Update key MCP servers with latest configs
    claude-code mcp remove sqlite -s local 2>/dev/null || true
    claude-code mcp add-json sqlite '{
        "command": "mcp-server-sqlite",
        "args": ["--db-path", "/Users/daniel/databases/productivity.db"]
    }' 2>/dev/null || true
    
    claude-code mcp remove browserbase -s local 2>/dev/null || true
    claude-code mcp add-json browserbase '{
        "command": "npx",
        "args": ["-y", "@browserbasehq/mcp-server-browserbase"],
        "env": {
            "BROWSERBASE_API_KEY": "bb_live_ASSqBWpF_f8pKBq_sYh2jbGYNNI",
            "BROWSERBASE_PROJECT_ID": "a3eba0d1-f775-458e-b855-8760736c6817"
        }
    }' 2>/dev/null || true
    
    claude-code mcp remove claude-buddy-websocket -s local 2>/dev/null || true
    claude-code mcp add-json claude-buddy-websocket '{
        "command": "node",
        "args": ["/Users/daniel/claude-buddy/mcp-websocket-server.js"]
    }' 2>/dev/null || true
    
    log "✓ MCP servers configured"
}

# Update packages (background, non-blocking)
update_packages() {
    {
        npm install -g @browserbasehq/mcp-server-browserbase figma-mcp mcp-server-brave-search --silent 2>/dev/null || true
        pipx upgrade mcp-server-sqlite 2>/dev/null || true
        log "✓ Packages updated"
    } &
}

# Start health monitoring (autonomous)
start_health_monitor() {
    if ! pgrep -f "autonomous-health-monitor" >/dev/null; then
        nohup /Users/daniel/.claude/autonomous-health-monitor.sh >/dev/null 2>&1 &
        log "✓ Health monitor started"
    fi
}

# Main autonomous startup
main() {
    log "=== Autonomous Claude Startup ==="
    
    # Background package updates (don't wait)
    update_packages
    
    # Start Claude Buddy (retry on failure)
    for attempt in 1 2 3; do
        if start_claude_buddy; then
            break
        fi
        sleep 5
    done
    
    # Fix MCP servers
    fix_mcp_servers
    
    # Start health monitoring
    start_health_monitor
    
    log "=== Autonomous startup complete ==="
}

# Run main function
main 2>/dev/null || true

# Always succeed to avoid blocking Claude
exit 0