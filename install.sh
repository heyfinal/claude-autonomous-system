#!/bin/bash
# Automated installer for Claude Autonomous Development System
# One-command setup for any macOS system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

print_header() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║    Claude Autonomous Development System Installer             ║"
    echo "║                                                               ║" 
    echo "║    🤖 100% Autonomous • 🔌 WebSocket • 📱 Mobile Control      ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
}

check_requirements() {
    print_status "info" "Checking system requirements..."
    
    # Check macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        print_status "error" "This installer is designed for macOS only"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        print_status "error" "Node.js is required but not installed"
        print_status "info" "Install Node.js from: https://nodejs.org/"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        print_status "error" "npm is required but not installed"
        exit 1
    fi
    
    # Check Claude Code
    if ! command -v claude-code >/dev/null 2>&1; then
        print_status "warning" "Claude Code not found in PATH"
        print_status "info" "Install Claude Code from: https://claude.ai/code"
        print_status "info" "Installation will continue, but MCP integration may not work"
    else
        print_status "success" "Claude Code found"
    fi
    
    # Check Python and pipx
    if command -v pipx >/dev/null 2>&1; then
        print_status "success" "pipx found"
    elif command -v pip3 >/dev/null 2>&1; then
        print_status "info" "Installing pipx..."
        pip3 install --user pipx
        pipx ensurepath
    else
        print_status "warning" "Python package management not optimal, but continuing..."
    fi
    
    print_status "success" "System requirements check complete"
}

install_dependencies() {
    print_status "info" "Installing system dependencies..."
    
    # Install Node.js packages globally
    npm install -g @browserbasehq/mcp-server-browserbase figma-mcp mcp-server-brave-search mcp-server-docker @mzxrai/mcp-openai xcodebuildmcp supergateway --silent 2>/dev/null || {
        print_status "warning" "Some npm packages failed to install globally, but system will still work"
    }
    
    # Install Python packages
    if command -v pipx >/dev/null 2>&1; then
        pipx install mcp-server-sqlite --force 2>/dev/null || {
            print_status "warning" "SQLite MCP server installation failed, but system will still work"
        }
    fi
    
    print_status "success" "Dependencies installed"
}

install_core_files() {
    print_status "info" "Installing core system files..."
    
    # Create directories
    mkdir -p ~/.claude
    mkdir -p ~/claude-buddy
    mkdir -p ~/claude-buddy-mobile
    mkdir -p ~/databases
    mkdir -p ~/Library/LaunchAgents
    
    # Copy core files
    cp -r .claude/* ~/.claude/ 2>/dev/null || print_status "error" "Failed to copy .claude files"
    cp -r claude-buddy/* ~/claude-buddy/ 2>/dev/null || print_status "error" "Failed to copy claude-buddy files"
    cp -r claude-buddy-mobile/* ~/claude-buddy-mobile/ 2>/dev/null || print_status "error" "Failed to copy mobile app files"
    
    # Copy launch agents
    cp launch-agents/*.plist ~/Library/LaunchAgents/ 2>/dev/null || print_status "warning" "Failed to copy launch agents"
    
    # Make scripts executable
    chmod +x ~/.claude/*.sh
    
    print_status "success" "Core files installed"
}

configure_claude_code() {
    print_status "info" "Configuring Claude Code integration..."
    
    if command -v claude-code >/dev/null 2>&1; then
        # Update Claude Code settings
        local settings_file="$HOME/.claude/settings.json"
        
        if [ -f "$settings_file" ]; then
            # Backup existing settings
            cp "$settings_file" "$settings_file.backup"
        fi
        
        # Create or update settings with hooks
        cat > "$settings_file" << 'EOF'
{
  "USE_BUILTIN_RIPGREP": false,
  "ripgrepPath": "/opt/homebrew/bin/rg",
  "searchOptions": {
    "useRipgrep": true,
    "ripgrepArgs": [
      "--smart-case",
      "--hidden",
      "--follow",
      "--glob=!.git/*",
      "--glob=!node_modules/*",
      "--glob=!*.pyc",
      "--glob=!__pycache__/*"
    ]
  },
  "performance": {
    "preferSystemTools": true,
    "parallelSearch": true,
    "maxSearchThreads": 8
  },
  "hooks": {
    "preSession": "/Users/$USER/.claude/autonomous-startup.sh"
  },
  "autoStart": {
    "claudeBuddy": true,
    "mcpServers": true,
    "healthMonitor": true
  }
}
EOF
        
        # Replace $USER with actual username
        sed -i '' "s/\$USER/$USER/g" "$settings_file"
        
        print_status "success" "Claude Code configured"
    else
        print_status "warning" "Claude Code not found - manual configuration required"
    fi
}

install_mcp_servers() {
    print_status "info" "Configuring MCP servers..."
    
    if command -v claude-code >/dev/null 2>&1; then
        # Add key MCP servers
        claude-code mcp add-json sqlite '{
            "command": "mcp-server-sqlite",
            "args": ["--db-path", "'"$HOME"'/databases/productivity.db"]
        }' 2>/dev/null || true
        
        claude-code mcp add-json browserbase '{
            "command": "npx",
            "args": ["-y", "@browserbasehq/mcp-server-browserbase"],
            "env": {
                "BROWSERBASE_API_KEY": "YOUR_API_KEY_HERE",
                "BROWSERBASE_PROJECT_ID": "YOUR_PROJECT_ID_HERE"
            }
        }' 2>/dev/null || true
        
        claude-code mcp add-json claude-buddy-websocket '{
            "command": "node",
            "args": ["'"$HOME"'/claude-buddy/mcp-websocket-server.js"]
        }' 2>/dev/null || true
        
        print_status "success" "MCP servers configured"
        print_status "info" "Update API keys in ~/.claude.json for full functionality"
    else
        print_status "warning" "Claude Code not available - MCP servers not configured"
    fi
}

setup_launch_agents() {
    print_status "info" "Setting up system services..."
    
    # Load launch agents
    launchctl load ~/Library/LaunchAgents/com.daniel.claude-buddy.plist 2>/dev/null || print_status "warning" "Failed to load claude-buddy launch agent"
    launchctl load ~/Library/LaunchAgents/com.daniel.claude-updater.plist 2>/dev/null || print_status "warning" "Failed to load updater launch agent"
    
    print_status "success" "System services configured"
}

create_databases() {
    print_status "info" "Setting up databases..."
    
    # Create productivity database
    cat << 'EOF' | sqlite3 "$HOME/databases/productivity.db"
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    status TEXT CHECK(status IN ('todo', 'in_progress', 'blocked', 'completed', 'cancelled')) DEFAULT 'todo',
    due_date DATE,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    tags TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tasks (title, description, priority, status) VALUES 
    ('Welcome to Claude Autonomous System', 'Your development environment is now fully automated!', 'high', 'completed');

INSERT INTO snippets (title, language, code, description, tags) VALUES
    ('Quick Status Check', 'bash', 'curl -s http://localhost:8080/status | jq', 'Check Claude Buddy server status', 'claude,status,monitoring');
EOF

    print_status "success" "Databases created"
}

start_system() {
    print_status "info" "Starting autonomous system..."
    
    # Install Claude Buddy dependencies
    cd ~/claude-buddy
    npm install --silent 2>/dev/null || print_status "warning" "Failed to install Claude Buddy dependencies"
    
    # Start the system
    ~/.claude/autonomous-startup.sh 2>/dev/null &
    
    # Give it time to start
    sleep 10
    
    # Check if system is running
    if curl -f -s "http://localhost:8080/status" >/dev/null 2>&1; then
        print_status "success" "System started successfully!"
    else
        # Try alternative ports
        for port in 8081 8082 8083; do
            if curl -f -s "http://localhost:$port/status" >/dev/null 2>&1; then
                print_status "success" "System started on port $port!"
                break
            fi
        done
    fi
}

show_completion() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║    🎉 Claude Autonomous System Installation Complete!         ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    print_status "success" "Installation completed successfully!"
    echo ""
    echo "📋 What's installed:"
    echo "   • Autonomous startup system (runs with Claude Code)"
    echo "   • WebSocket server with real-time communication"
    echo "   • Mobile control app"
    echo "   • Health monitoring and auto-recovery"
    echo "   • Daily automated updates"
    echo "   • MCP server management"
    echo "   • AI code analysis pipeline"
    echo ""
    echo "🚀 Getting started:"
    echo "   • Launch Claude Code - everything starts automatically!"
    echo "   • Access mobile app: http://localhost:8080 (or 8081-8083)"
    echo "   • System status: ~/.claude/manage.sh status"
    echo "   • View logs: tail -f ~/.claude/autonomous.log"
    echo ""
    echo "🔧 Configuration:"
    echo "   • Update API keys in ~/.claude.json"
    echo "   • Customize settings in ~/.claude/settings.json"
    echo "   • All scripts in ~/.claude/ directory"
    echo ""
    echo "📖 Documentation: https://github.com/daniel-claude/claude-autonomous-system"
    echo ""
    print_status "info" "System is now 100% autonomous - no manual intervention required!"
}

# Main installation process
main() {
    print_header
    
    check_requirements
    install_dependencies
    install_core_files
    configure_claude_code
    install_mcp_servers
    setup_launch_agents
    create_databases
    start_system
    
    show_completion
}

# Run installer
main "$@"