#!/bin/bash
# Claude Auto-Updater
# Automatically updates Claude Code, MCP servers, and Claude Buddy

set -e

LOG_FILE="/Users/daniel/.claude/auto-updater.log"
LAST_UPDATE_FILE="/Users/daniel/.claude/.last_update"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if we should update (once per day)
should_update() {
    if [ ! -f "$LAST_UPDATE_FILE" ]; then
        return 0  # First run, should update
    fi
    
    local last_update
    last_update=$(cat "$LAST_UPDATE_FILE" 2>/dev/null || echo "0")
    local current_time
    current_time=$(date +%s)
    local time_diff
    time_diff=$((current_time - last_update))
    local one_day
    one_day=$((24 * 60 * 60))
    
    [ $time_diff -gt $one_day ]
}

# Update Claude Code
update_claude_code() {
    log "Checking for Claude Code updates..."
    
    local current_version
    if current_version=$(claude-code --version 2>/dev/null); then
        log "Current Claude Code version: $current_version"
        
        # Check for updates
        if claude-code update --check 2>/dev/null; then
            log "Updating Claude Code..."
            claude-code update || log "WARNING: Claude Code update failed"
        else
            log "Claude Code is up to date"
        fi
    else
        log "WARNING: Could not get Claude Code version"
    fi
}

# Update Node.js packages
update_nodejs_packages() {
    log "Updating Node.js MCP packages..."
    
    local packages=(
        "@modelcontextprotocol/server-filesystem"
        "@modelcontextprotocol/server-memory" 
        "@modelcontextprotocol/server-sequential-thinking"
        "@modelcontextprotocol/server-puppeteer"
        "@browserbasehq/mcp-server-browserbase"
        "figma-mcp"
        "mcp-server-brave-search"
        "mcp-server-docker"
        "@mzxrai/mcp-openai"
        "xcodebuildmcp"
        "supergateway"
    )
    
    for package in "${packages[@]}"; do
        log "Updating $package..."
        npm install -g "$package" --silent 2>/dev/null || log "WARNING: Failed to update $package"
    done
    
    log "✓ Node.js packages updated"
}

# Update Python packages
update_python_packages() {
    log "Updating Python MCP packages..."
    
    local packages=(
        "mcp-server-sqlite"
    )
    
    for package in "${packages[@]}"; do
        log "Updating $package..."
        pipx upgrade "$package" 2>/dev/null || log "WARNING: Failed to update $package"
    done
    
    log "✓ Python packages updated"
}

# Update Claude Buddy
update_claude_buddy() {
    log "Updating Claude Buddy..."
    
    local claude_buddy_dir="/Users/daniel/claude-buddy"
    if [ -d "$claude_buddy_dir" ]; then
        cd "$claude_buddy_dir"
        
        # Update dependencies
        log "Updating Claude Buddy dependencies..."
        npm update --silent 2>/dev/null || log "WARNING: Failed to update Claude Buddy dependencies"
        
        # Check if server needs restart
        local pid_file="/Users/daniel/.claude/claude-buddy.pid"
        if [ -f "$pid_file" ]; then
            local pid
            pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                log "Restarting Claude Buddy server after update..."
                kill "$pid" 2>/dev/null || true
                sleep 2
                /Users/daniel/.claude/startup.sh
            fi
        fi
        
        log "✓ Claude Buddy updated"
    else
        log "WARNING: Claude Buddy directory not found"
    fi
}

# Update system packages (Homebrew)
update_system_packages() {
    log "Updating system packages..."
    
    if command -v brew >/dev/null 2>&1; then
        # Update Homebrew packages that might affect Claude
        brew upgrade node npm pipx 2>/dev/null || log "WARNING: Some Homebrew packages failed to update"
        log "✓ System packages updated"
    else
        log "Homebrew not found, skipping system package updates"
    fi
}

# Clean up old logs and temporary files
cleanup() {
    log "Performing cleanup..."
    
    # Rotate logs if they're too large (>10MB)
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || echo "0") -gt 10485760 ]; then
        mv "$LOG_FILE" "$LOG_FILE.old"
        log "Log file rotated"
    fi
    
    # Clean up npm cache
    npm cache clean --force --silent 2>/dev/null || true
    
    # Clean up old database backups (keep last 7 days)
    find /Users/daniel/databases -name "backup_*.db" -mtime +7 -delete 2>/dev/null || true
    
    log "✓ Cleanup completed"
}

# Verify all systems are working after update
verify_systems() {
    log "Verifying systems after update..."
    
    # Check Claude Code
    if claude-code --version >/dev/null 2>&1; then
        log "✓ Claude Code working"
    else
        log "ERROR: Claude Code not working after update"
    fi
    
    # Check Claude Buddy
    if curl -f -s "http://localhost:8080/status" >/dev/null 2>&1; then
        log "✓ Claude Buddy working"
    else
        log "WARNING: Claude Buddy not responding"
    fi
    
    # Check MCP servers
    local mcp_status
    if mcp_status=$(claude-code mcp list 2>&1); then
        local connected_count
        connected_count=$(echo "$mcp_status" | grep -c "✓ Connected" || echo "0")
        log "✓ $connected_count MCP servers connected"
    else
        log "WARNING: Could not check MCP server status"
    fi
}

# Send update notification
send_notification() {
    local message="$1"
    
    # Send to Claude Buddy if running
    if curl -f -s "http://localhost:8080/status" >/dev/null 2>&1; then
        curl -s -X POST "http://localhost:8080/broadcast" \
            -H "Content-Type: application/json" \
            -d "{\"message\": \"$message\"}" >/dev/null 2>&1 || true
    fi
    
    log "$message"
}

# Main update process
main() {
    log "=== Auto-Update Process Started ==="
    
    # Check if we should run updates
    if ! should_update; then
        log "Updates already performed today, skipping..."
        return 0
    fi
    
    send_notification "🔄 Starting auto-update process..."
    
    # Perform updates
    update_claude_code
    update_nodejs_packages
    update_python_packages
    update_claude_buddy
    update_system_packages
    
    # Cleanup
    cleanup
    
    # Verify everything is working
    verify_systems
    
    # Mark update as completed
    date +%s > "$LAST_UPDATE_FILE"
    
    send_notification "✅ Auto-update completed successfully"
    log "=== Auto-Update Process Completed ==="
}

# Run with error handling
if main "$@"; then
    log "Auto-update completed successfully"
    exit 0
else
    log "Auto-update completed with some warnings"
    exit 0  # Don't fail completely on warnings
fi