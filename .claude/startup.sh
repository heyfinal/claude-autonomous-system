#!/bin/bash
# Claude Startup Script
# Ensures all MCP servers are connected and Claude Buddy is running

set -e  # Exit on any error

# Configuration
CLAUDE_BUDDY_DIR="/Users/daniel/claude-buddy"
LOG_FILE="/Users/daniel/.claude/startup.log"
PID_FILE="/Users/daniel/.claude/claude-buddy.pid"
HEALTH_CHECK_INTERVAL=30
MAX_RETRIES=3

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

log "=== Claude Startup Script Initiated ==="

# Check if Claude Buddy is already running
if [ -f "$PID_FILE" ]; then
    EXISTING_PID=$(cat "$PID_FILE")
    if kill -0 "$EXISTING_PID" 2>/dev/null; then
        log "Claude Buddy already running with PID $EXISTING_PID"
    else
        log "Stale PID file found, removing..."
        rm "$PID_FILE"
    fi
fi

# Function to start Claude Buddy WebSocket server
start_claude_buddy() {
    log "Starting Claude Buddy WebSocket server..."
    
    if [ ! -d "$CLAUDE_BUDDY_DIR" ]; then
        error_exit "Claude Buddy directory not found: $CLAUDE_BUDDY_DIR"
    fi
    
    cd "$CLAUDE_BUDDY_DIR"
    
    # Install/update dependencies
    log "Checking Claude Buddy dependencies..."
    npm install --silent || error_exit "Failed to install Claude Buddy dependencies"
    
    # Start server in background
    nohup node server.js > /dev/null 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > "$PID_FILE"
    
    # Wait for server to start
    sleep 3
    
    # Verify server is running
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        error_exit "Failed to start Claude Buddy server"
    fi
    
    # Test WebSocket connection
    if curl -f -s "http://localhost:8080/status" > /dev/null; then
        log "✓ Claude Buddy server started successfully (PID: $SERVER_PID)"
        
        # Start notification system
        log "Starting notification system..."
        nohup node notifications.js > /dev/null 2>&1 &
        NOTIF_PID=$!
        log "✓ Notification system started (PID: $NOTIF_PID)"
        
        return 0
    else
        log "Server started but not responding, retrying..."
        kill "$SERVER_PID" 2>/dev/null || true
        rm "$PID_FILE"
        return 1
    fi
}

# Function to update MCP servers
update_mcp_servers() {
    log "Updating MCP server packages..."
    
    # Update global packages
    npm update -g @modelcontextprotocol/server-filesystem 2>/dev/null || true
    npm update -g @modelcontextprotocol/server-memory 2>/dev/null || true
    npm update -g @modelcontextprotocol/server-sequential-thinking 2>/dev/null || true
    npm update -g @modelcontextprotocol/server-puppeteer 2>/dev/null || true
    npm update -g @browserbasehq/mcp-server-browserbase 2>/dev/null || true
    npm update -g figma-mcp 2>/dev/null || true
    npm update -g mcp-server-brave-search 2>/dev/null || true
    npm update -g mcp-server-docker 2>/dev/null || true
    npm update -g @mzxrai/mcp-openai 2>/dev/null || true
    npm update -g xcodebuildmcp 2>/dev/null || true
    npm update -g supergateway 2>/dev/null || true
    
    # Update Python packages
    pipx upgrade mcp-server-sqlite 2>/dev/null || true
    
    log "✓ MCP server packages updated"
}

# Function to check and fix MCP server connections
check_mcp_servers() {
    log "Checking MCP server connections..."
    
    local retry_count=0
    local max_retries=3
    
    while [ $retry_count -lt $max_retries ]; do
        # Get MCP server status
        local mcp_status
        if mcp_status=$(claude-code mcp list 2>&1); then
            local connected_count
            local failed_count
            
            connected_count=$(echo "$mcp_status" | grep -c "✓ Connected" 2>/dev/null || echo "0")
            failed_count=$(echo "$mcp_status" | grep -c "✗ Failed to connect" 2>/dev/null || echo "0")
            
            log "MCP Status: $connected_count connected, $failed_count failed"
            
            if [ "$failed_count" -eq 0 ] 2>/dev/null; then
                log "✓ All MCP servers connected successfully"
                return 0
            else
                log "Found $failed_count failed MCP servers, attempting to fix..."
                
                # Try to restart failed servers
                fix_failed_mcp_servers
                
                retry_count=$((retry_count + 1))
                if [ $retry_count -lt $max_retries ]; then
                    log "Retrying MCP server check in 10 seconds... (attempt $((retry_count + 1))/$max_retries)"
                    sleep 10
                fi
            fi
        else
            error_exit "Failed to get MCP server status"
        fi
    done
    
    log "WARNING: Some MCP servers still failing after $max_retries attempts"
    return 1
}

# Function to fix failed MCP servers
fix_failed_mcp_servers() {
    log "Attempting to fix failed MCP servers..."
    
    # Common fixes for known issues
    
    # Fix SQLite server path issues
    claude-code mcp remove sqlite -s local 2>/dev/null || true
    claude-code mcp add-json sqlite '{
        "command": "mcp-server-sqlite",
        "args": ["--db-path", "/Users/daniel/databases/productivity.db"]
    }' 2>/dev/null || true
    
    # Fix Browserbase server
    claude-code mcp remove browserbase -s local 2>/dev/null || true
    claude-code mcp add-json browserbase '{
        "command": "npx",
        "args": ["-y", "@browserbasehq/mcp-server-browserbase"],
        "env": {
            "BROWSERBASE_API_KEY": "bb_live_ASSqBWpF_f8pKBq_sYh2jbGYNNI",
            "BROWSERBASE_PROJECT_ID": "a3eba0d1-f775-458e-b855-8760736c6817"
        }
    }' 2>/dev/null || true
    
    # Fix Figma server
    claude-code mcp remove figma -s local 2>/dev/null || true
    claude-code mcp add-json figma '{
        "command": "npx",
        "args": ["-y", "figma-mcp"],
        "env": {"FIGMA_PERSONAL_ACCESS_TOKEN": "YOUR_FIGMA_TOKEN_HERE"}
    }' 2>/dev/null || true
    
    # Ensure Claude Buddy WebSocket server is added
    claude-code mcp remove claude-buddy-websocket -s local 2>/dev/null || true
    claude-code mcp add-json claude-buddy-websocket '{
        "command": "node",
        "args": ["/Users/daniel/claude-buddy/mcp-websocket-server.js"]
    }' 2>/dev/null || true
    
    log "Applied common MCP server fixes"
}

# Function to create health monitor daemon
create_health_monitor() {
    log "Creating health monitor daemon..."
    
    cat > "/Users/daniel/.claude/health-monitor.sh" << 'EOF'
#!/bin/bash
# Health Monitor for Claude Buddy and MCP Servers

LOG_FILE="/Users/daniel/.claude/health-monitor.log"
PID_FILE="/Users/daniel/.claude/claude-buddy.pid"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

while true; do
    # Check Claude Buddy server
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ! kill -0 "$PID" 2>/dev/null || ! curl -f -s "http://localhost:8080/status" > /dev/null; then
            log "Claude Buddy server not responding, restarting..."
            /Users/daniel/.claude/startup.sh
        fi
    else
        log "Claude Buddy not running, starting..."
        /Users/daniel/.claude/startup.sh
    fi
    
    # Sleep for 5 minutes
    sleep 300
done
EOF
    
    chmod +x "/Users/daniel/.claude/health-monitor.sh"
    log "✓ Health monitor daemon created"
}

# Main execution flow
main() {
    # Create necessary directories
    mkdir -p /Users/daniel/databases
    mkdir -p /Users/daniel/.claude
    
    # Update MCP servers
    update_mcp_servers
    
    # Start Claude Buddy (with retries)
    local retry_count=0
    while [ $retry_count -lt $MAX_RETRIES ]; do
        if start_claude_buddy; then
            break
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $MAX_RETRIES ]; then
                log "Retrying Claude Buddy startup... (attempt $((retry_count + 1))/$MAX_RETRIES)"
                sleep 5
            else
                error_exit "Failed to start Claude Buddy after $MAX_RETRIES attempts"
            fi
        fi
    done
    
    # Check and fix MCP servers
    check_mcp_servers
    
    # Create health monitor
    create_health_monitor
    
    # Start health monitor in background if not already running
    if ! pgrep -f "health-monitor.sh" > /dev/null; then
        log "Starting health monitor daemon..."
        nohup /Users/daniel/.claude/health-monitor.sh > /dev/null 2>&1 &
        log "✓ Health monitor daemon started"
    else
        log "Health monitor already running"
    fi
    
    log "=== Claude Startup Complete ==="
    log "✓ Claude Buddy WebSocket server: http://localhost:8080"
    log "✓ MCP servers checked and configured"
    log "✓ Health monitoring active"
    log "✓ Auto-updates enabled"
}

# Run main function
main "$@"