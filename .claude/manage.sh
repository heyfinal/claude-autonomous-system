#!/bin/bash
# Claude System Management Script
# Easy control of Claude Buddy and all related services

set -e

CLAUDE_BUDDY_DIR="/Users/daniel/claude-buddy"
PID_FILE="/Users/daniel/.claude/claude-buddy.pid"
LOG_FILE="/Users/daniel/.claude/startup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    local status="$1"
    local message="$2"
    case $status in
        "success") echo -e "${GREEN}✓${NC} $message" ;;
        "error") echo -e "${RED}✗${NC} $message" ;;
        "warning") echo -e "${YELLOW}⚠${NC} $message" ;;
        "info") echo -e "${BLUE}ℹ${NC} $message" ;;
    esac
}

# Show system status
status() {
    echo "=== Claude System Status ==="
    echo
    
    # Claude Buddy Server Status
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        if curl -f -s "http://localhost:8080/status" >/dev/null; then
            local server_info
            server_info=$(curl -s "http://localhost:8080/status")
            local clients
            clients=$(echo "$server_info" | jq -r '.clients // 0')
            local uptime
            uptime=$(echo "$server_info" | jq -r '.uptime // 0')
            print_status "success" "Claude Buddy Server: Running (PID: $(cat "$PID_FILE"), $clients clients, ${uptime}s uptime)"
        else
            print_status "error" "Claude Buddy Server: Process running but not responding"
        fi
    else
        print_status "error" "Claude Buddy Server: Not running"
    fi
    
    # Health Monitor Status
    if pgrep -f "health-monitor.sh" >/dev/null; then
        print_status "success" "Health Monitor: Running (PID: $(pgrep -f health-monitor.sh))"
    else
        print_status "warning" "Health Monitor: Not running"
    fi
    
    # Notification System Status
    if pgrep -f "notifications.js" >/dev/null; then
        print_status "success" "Notification System: Running (PID: $(pgrep -f notifications.js))"
    else
        print_status "warning" "Notification System: Not running"
    fi
    
    # LaunchAgent Status
    if launchctl list | grep -q "com.daniel.claude-buddy"; then
        print_status "success" "LaunchAgent (claude-buddy): Loaded"
    else
        print_status "warning" "LaunchAgent (claude-buddy): Not loaded"
    fi
    
    if launchctl list | grep -q "com.daniel.claude-updater"; then
        print_status "success" "LaunchAgent (updater): Loaded"
    else
        print_status "warning" "LaunchAgent (updater): Not loaded"
    fi
    
    echo
    echo "=== MCP Server Status ==="
    
    # MCP Server Status
    if command -v claude-code >/dev/null 2>&1; then
        local mcp_output
        if mcp_output=$(claude-code mcp list 2>&1); then
            local connected
            local failed
            connected=$(echo "$mcp_output" | grep -c "✓ Connected" 2>/dev/null || echo "0")
            failed=$(echo "$mcp_output" | grep -c "✗ Failed to connect" 2>/dev/null || echo "0")
            
            # Ensure we have valid numbers
            connected=${connected// /}
            failed=${failed// /}
            
            if [ "${failed:-0}" -eq 0 ] 2>/dev/null; then
                print_status "success" "MCP Servers: All $connected servers connected"
            else
                print_status "warning" "MCP Servers: $connected connected, $failed failed"
                
                echo
                echo "Failed servers:"
                echo "$mcp_output" | grep "✗ Failed to connect" | sed 's/^/  /'
            fi
        else
            print_status "error" "MCP Servers: Could not check status"
        fi
    else
        print_status "error" "Claude Code: Not installed or not in PATH"
    fi
}

# Start all services
start() {
    print_status "info" "Starting Claude system..."
    
    # Run startup script
    if /Users/daniel/.claude/startup.sh >/dev/null 2>&1; then
        print_status "success" "System started successfully"
    else
        print_status "error" "System startup failed - check $LOG_FILE"
        exit 1
    fi
}

# Stop all services
stop() {
    print_status "info" "Stopping Claude system..."
    
    # Stop Claude Buddy server
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            rm -f "$PID_FILE"
            print_status "success" "Claude Buddy server stopped"
        fi
    fi
    
    # Stop notification system
    pkill -f "notifications.js" 2>/dev/null && print_status "success" "Notification system stopped" || true
    
    # Stop health monitor
    pkill -f "health-monitor.sh" 2>/dev/null && print_status "success" "Health monitor stopped" || true
    
    print_status "success" "System stopped"
}

# Restart all services
restart() {
    print_status "info" "Restarting Claude system..."
    stop
    sleep 2
    start
}

# Show logs
logs() {
    local service="${1:-startup}"
    
    case $service in
        "startup"|"main")
            tail -n 50 "/Users/daniel/.claude/startup.log" 2>/dev/null || echo "No startup logs found"
            ;;
        "health")
            tail -n 50 "/Users/daniel/.claude/health-monitor.log" 2>/dev/null || echo "No health monitor logs found"
            ;;
        "updater")
            tail -n 50 "/Users/daniel/.claude/auto-updater.log" 2>/dev/null || echo "No updater logs found"
            ;;
        "launchd")
            tail -n 50 "/Users/daniel/.claude/launchd.log" 2>/dev/null || echo "No launchd logs found"
            ;;
        *)
            echo "Available logs: startup, health, updater, launchd"
            ;;
    esac
}

# Update system
update() {
    print_status "info" "Running system update..."
    
    if /Users/daniel/.claude/auto-updater.sh; then
        print_status "success" "System updated successfully"
    else
        print_status "warning" "System update completed with warnings"
    fi
}

# Test system
test() {
    print_status "info" "Testing Claude system..."
    
    # Test WebSocket server
    if curl -f -s "http://localhost:8080/status" >/dev/null; then
        print_status "success" "WebSocket server responding"
    else
        print_status "error" "WebSocket server not responding"
    fi
    
    # Test MCP servers
    if claude-code mcp list >/dev/null 2>&1; then
        print_status "success" "MCP servers accessible"
    else
        print_status "error" "MCP servers not accessible"
    fi
    
    # Test database
    if sqlite3 "/Users/daniel/databases/productivity.db" "SELECT COUNT(*) FROM sqlite_master;" >/dev/null 2>&1; then
        print_status "success" "Database accessible"
    else
        print_status "error" "Database not accessible"
    fi
    
    print_status "info" "System test completed"
}

# Install/setup system
install() {
    print_status "info" "Installing Claude system services..."
    
    # Load LaunchAgents
    launchctl load /Users/daniel/Library/LaunchAgents/com.daniel.claude-buddy.plist 2>/dev/null
    launchctl load /Users/daniel/Library/LaunchAgents/com.daniel.claude-updater.plist 2>/dev/null
    
    # Start services
    start
    
    print_status "success" "System installed and started"
}

# Show usage
usage() {
    echo "Claude System Management"
    echo
    echo "Usage: $0 {command} [options]"
    echo
    echo "Commands:"
    echo "  status     - Show system status"
    echo "  start      - Start all services"  
    echo "  stop       - Stop all services"
    echo "  restart    - Restart all services"
    echo "  logs [type] - Show logs (startup, health, updater, launchd)"
    echo "  update     - Update all components"
    echo "  test       - Test system functionality"
    echo "  install    - Install and start services"
    echo "  help       - Show this help"
    echo
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 logs startup"
    echo "  $0 restart"
}

# Main command handler
main() {
    case "${1:-status}" in
        "status"|"st")
            status
            ;;
        "start")
            start
            ;;
        "stop")
            stop
            ;;
        "restart"|"r")
            restart
            ;;
        "logs"|"log")
            logs "$2"
            ;;
        "update"|"up")
            update
            ;;
        "test"|"t")
            test
            ;;
        "install"|"i")
            install
            ;;
        "help"|"h"|"-h"|"--help")
            usage
            ;;
        *)
            echo "Unknown command: $1"
            echo
            usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"