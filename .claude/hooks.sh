#!/bin/bash
# Claude Code Hooks
# Integrates startup script with Claude Code sessions

# Pre-session hook - runs before Claude Code starts
pre_session_hook() {
    echo "[Claude Hook] Starting Claude Buddy and MCP servers..."
    
    # Run startup script
    /Users/daniel/.claude/startup.sh
    
    # Brief delay to ensure everything is ready
    sleep 2
    
    echo "[Claude Hook] Systems ready ✓"
}

# Post-session hook - runs after Claude Code ends
post_session_hook() {
    echo "[Claude Hook] Claude Code session ended"
    
    # Log session end
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Claude Code session ended" >> /Users/daniel/.claude/session.log
    
    # Keep Claude Buddy running for other sessions
    echo "[Claude Hook] Claude Buddy remains active for future sessions"
}

# Handle different hook types
case "$1" in
    "pre")
        pre_session_hook
        ;;
    "post") 
        post_session_hook
        ;;
    *)
        echo "Usage: $0 {pre|post}"
        exit 1
        ;;
esac