#!/bin/bash
# Autonomous Health Monitor - Runs continuously in background
# Zero manual intervention required

while true; do
    {
        # Check Claude Buddy server
        for port in 8080 8081 8082 8083; do
            if curl -f -s "http://localhost:$port/status" >/dev/null 2>&1; then
                break
            elif [ $port -eq 8083 ]; then
                # Start server if none found
                /Users/daniel/.claude/autonomous-startup.sh >/dev/null 2>&1 &
            fi
        done
        
        # Auto-fix failed MCP servers
        if command -v claude-code >/dev/null 2>&1; then
            failed=$(claude-code mcp list 2>&1 | grep -c "✗ Failed to connect" 2>/dev/null || echo "0")
            if [ "${failed:-0}" -gt 0 ] 2>/dev/null; then
                /Users/daniel/.claude/autonomous-startup.sh >/dev/null 2>&1 &
            fi
        fi
    } 2>/dev/null
    
    # Check every 2 minutes
    sleep 120
done