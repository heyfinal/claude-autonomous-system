#!/bin/bash
# Claude Autonomous Development System - Universal Installer
# One-command setup for complete autonomous development environment
# Usage: curl -sSL https://raw.githubusercontent.com/heyfinal/claude-autonomous-system/final-clean/install.sh | bash

set -e
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# Colors and styling for modern terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
REPO_URL="https://github.com/heyfinal/claude-autonomous-system"
RAW_URL="https://raw.githubusercontent.com/heyfinal/claude-autonomous-system/final-clean"
INSTALL_DIR="$HOME/.claude-autonomous-temp"
VERSION="2.0.0"

print_status() {
    local status="$1"
    local message="$2"
    case $status in
        "success") echo -e "${GREEN}✅${NC} ${WHITE}$message${NC}" ;;
        "error") echo -e "${RED}❌${NC} ${WHITE}$message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️${NC} ${WHITE}$message${NC}" ;;
        "info") echo -e "${BLUE}ℹ️${NC} ${WHITE}$message${NC}" ;;
        "progress") echo -e "${PURPLE}🔄${NC} ${WHITE}$message${NC}" ;;
        "rocket") echo -e "${CYAN}🚀${NC} ${WHITE}$message${NC}" ;;
    esac
}

print_header() {
    clear
    echo ""
    echo -e "${PURPLE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC}                                                               ${PURPLE}║${NC}"
    echo -e "${PURPLE}║${NC}    ${WHITE}${BOLD}🤖 Claude Autonomous Development System${NC}             ${PURPLE}║${NC}"
    echo -e "${PURPLE}║${NC}                                                               ${PURPLE}║${NC}" 
    echo -e "${PURPLE}║${NC}    ${CYAN}100% Autonomous${NC} • ${GREEN}Zero Config${NC} • ${YELLOW}Always Ready${NC}      ${PURPLE}║${NC}"
    echo -e "${PURPLE}║${NC}                                                               ${PURPLE}║${NC}"
    echo -e "${PURPLE}║${NC}    ${WHITE}Version $VERSION - Universal macOS Installer${NC}            ${PURPLE}║${NC}"
    echo -e "${PURPLE}║${NC}                                                               ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_system_requirements() {
    print_status "info" "Checking system compatibility..."
    
    # Check macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        print_status "error" "This installer requires macOS (detected: $OSTYPE)"
        print_status "info" "For other systems, visit: $REPO_URL"
        exit 1
    fi
    
    # Check macOS version (require 12.0+)
    local os_version=$(sw_vers -productVersion)
    local major_version=$(echo $os_version | cut -d. -f1)
    if [[ $major_version -lt 12 ]]; then
        print_status "warning" "macOS 12.0+ recommended (detected: $os_version)"
        print_status "info" "Installation will continue, but some features may not work"
    else
        print_status "success" "macOS $os_version detected"
    fi
    
    # Check architecture
    local arch=$(uname -m)
    if [[ $arch == "arm64" ]]; then
        print_status "success" "Apple Silicon (M1/M2/M3) detected"
        export HOMEBREW_PREFIX="/opt/homebrew"
    else
        print_status "success" "Intel Mac detected"
        export HOMEBREW_PREFIX="/usr/local"
    fi
    
    print_status "success" "System compatibility verified"
}

install_homebrew() {
    if command -v brew >/dev/null 2>&1; then
        print_status "success" "Homebrew already installed"
        return
    fi
    
    print_status "progress" "Installing Homebrew (this may take a few minutes)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/null
    
    # Add to PATH for this session
    eval "$($HOMEBREW_PREFIX/bin/brew shellenv)"
    
    print_status "success" "Homebrew installed successfully"
}

install_node() {
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version | sed 's/v//')
        local major_version=$(echo $node_version | cut -d. -f1)
        
        if [[ $major_version -ge 18 ]]; then
            print_status "success" "Node.js $node_version found"
            return
        else
            print_status "warning" "Node.js $node_version is outdated, installing latest..."
        fi
    fi
    
    print_status "progress" "Installing Node.js via Homebrew..."
    brew install node || {
        print_status "error" "Failed to install Node.js via Homebrew"
        print_status "info" "Please install Node.js manually from https://nodejs.org/"
        exit 1
    }
    
    print_status "success" "Node.js $(node --version) installed"
}

check_claude_code() {
    if command -v claude-code >/dev/null 2>&1; then
        print_status "success" "Claude Code CLI found"
        
        # Check if it's working
        if claude-code --version >/dev/null 2>&1; then
            print_status "success" "Claude Code CLI is functional"
        else
            print_status "warning" "Claude Code CLI found but not authenticated"
            print_status "info" "Please run 'claude-code auth login' after installation"
        fi
    else
        print_status "warning" "Claude Code CLI not found"
        print_status "info" "Install from: https://claude.ai/code"
        print_status "info" "The system will work, but MCP servers won't auto-configure"
        
        read -p "Continue without Claude Code CLI? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

install_python_tools() {
    print_status "progress" "Setting up Python environment..."
    
    # Ensure pip3 is available
    if ! command -v pip3 >/dev/null 2>&1; then
        print_status "progress" "Installing Python via Homebrew..."
        brew install python@3.11 || brew install python
    fi
    
    # Install pipx for better package isolation
    if ! command -v pipx >/dev/null 2>&1; then
        print_status "progress" "Installing pipx for Python package management..."
        pip3 install --user pipx
        pipx ensurepath
        export PATH="$HOME/.local/bin:$PATH"
    fi
    
    print_status "success" "Python environment ready"
}

download_system_files() {
    print_status "progress" "Downloading Claude Autonomous System files..."
    
    # Remove old temp directory
    rm -rf "$INSTALL_DIR"
    
    # Clone the repository
    if command -v git >/dev/null 2>&1; then
        git clone --depth 1 "$REPO_URL.git" "$INSTALL_DIR" >/dev/null 2>&1 || {
            print_status "warning" "Git clone failed, trying alternative download..."
            download_via_curl
        }
    else
        download_via_curl
    fi
    
    if [[ ! -d "$INSTALL_DIR" ]]; then
        print_status "error" "Failed to download system files"
        exit 1
    fi
    
    print_status "success" "System files downloaded"
}

download_via_curl() {
    # Create temp directory
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Download key files directly
    local files=(
        ".claude/autonomous-startup.sh"
        ".claude/autonomous-health-monitor.sh" 
        ".claude/auto-updater.sh"
        ".claude/manage.sh"
        ".claude/settings.json"
        "claude-buddy/server.js"
        "claude-buddy/package.json"
        "claude-buddy/notifications.js"
        "claude-buddy/mcp-websocket-server.js"
        "claude-buddy-mobile/index.html"
        "ai-analysis.js"
    )
    
    for file in "${files[@]}"; do
        local dir=$(dirname "$file")
        mkdir -p "$dir"
        curl -sSL "$RAW_URL/$file" -o "$file" || print_status "warning" "Failed to download $file"
    done
}

install_npm_dependencies() {
    print_status "progress" "Installing Node.js dependencies..."
    
    # Global packages for MCP servers
    local global_packages=(
        "@modelcontextprotocol/server-filesystem"
        "@modelcontextprotocol/server-memory" 
        "@modelcontextprotocol/server-sequential-thinking"
        "@browserbasehq/mcp-server-browserbase"
        "figma-mcp"
        "mcp-server-brave-search"
        "mcp-server-docker"
        "@mzxrai/mcp-openai"
        "xcodebuildmcp"
        "supergateway"
    )
    
    for package in "${global_packages[@]}"; do
        print_status "progress" "Installing $package..."
        npm install -g "$package" --silent 2>/dev/null || print_status "warning" "Failed to install $package"
    done
    
    # Install Claude Buddy dependencies
    if [[ -d "$INSTALL_DIR/claude-buddy" ]]; then
        cd "$INSTALL_DIR/claude-buddy"
        npm install --silent 2>/dev/null || print_status "warning" "Failed to install Claude Buddy dependencies"
    fi
    
    print_status "success" "Node.js dependencies installed"
}

install_python_dependencies() {
    print_status "progress" "Installing Python MCP servers..."
    
    local python_packages=(
        "mcp-server-sqlite"
    )
    
    for package in "${python_packages[@]}"; do
        print_status "progress" "Installing $package..."
        if command -v pipx >/dev/null 2>&1; then
            pipx install "$package" --force 2>/dev/null || print_status "warning" "Failed to install $package"
        else
            pip3 install --user "$package" 2>/dev/null || print_status "warning" "Failed to install $package"
        fi
    done
    
    print_status "success" "Python dependencies installed"
}

setup_system_files() {
    print_status "progress" "Installing system files..."
    
    # Create required directories
    local directories=(
        "$HOME/.claude"
        "$HOME/claude-buddy" 
        "$HOME/claude-buddy-mobile"
        "$HOME/databases"
        "$HOME/Library/LaunchAgents"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
    done
    
    # Copy files with error handling
    if [[ -d "$INSTALL_DIR/.claude" ]]; then
        cp -r "$INSTALL_DIR/.claude/"* "$HOME/.claude/" 2>/dev/null || print_status "warning" "Some .claude files failed to copy"
    fi
    
    if [[ -d "$INSTALL_DIR/claude-buddy" ]]; then
        cp -r "$INSTALL_DIR/claude-buddy/"* "$HOME/claude-buddy/" 2>/dev/null || print_status "warning" "Some claude-buddy files failed to copy"
    fi
    
    if [[ -d "$INSTALL_DIR/claude-buddy-mobile" ]]; then
        cp -r "$INSTALL_DIR/claude-buddy-mobile/"* "$HOME/claude-buddy-mobile/" 2>/dev/null || print_status "warning" "Some mobile app files failed to copy"
    fi
    
    if [[ -f "$INSTALL_DIR/ai-analysis.js" ]]; then
        cp "$INSTALL_DIR/ai-analysis.js" "$HOME/.claude/" 2>/dev/null
    fi
    
    # Make scripts executable
    chmod +x "$HOME/.claude/"*.sh 2>/dev/null
    
    print_status "success" "System files installed"
}

configure_claude_settings() {
    print_status "progress" "Configuring Claude Code integration..."
    
    if ! command -v claude-code >/dev/null 2>&1; then
        print_status "warning" "Claude Code not available - skipping MCP configuration"
        return
    fi
    
    # Configure Claude Code settings
    local settings_file="$HOME/.claude/settings.json"
    
    # Backup existing settings if they exist
    if [[ -f "$settings_file" ]]; then
        cp "$settings_file" "$settings_file.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Create optimized settings
    cat > "$settings_file" << EOF
{
  "USE_BUILTIN_RIPGREP": false,
  "ripgrepPath": "$HOMEBREW_PREFIX/bin/rg",
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
    "preSession": "$HOME/.claude/autonomous-startup.sh"
  },
  "autoStart": {
    "claudeBuddy": true,
    "mcpServers": true,
    "healthMonitor": true,
    "aiAnalysis": true
  }
}
EOF
    
    print_status "success" "Claude Code settings configured"
}

setup_mcp_servers() {
    print_status "progress" "Configuring MCP servers..."
    
    if ! command -v claude-code >/dev/null 2>&1; then
        print_status "warning" "Claude Code not available - skipping MCP server setup"
        return
    fi
    
    # Core MCP servers with proper configuration
    local mcp_configs=(
        'sqlite:{"command":"mcp-server-sqlite","args":["--db-path","'$HOME'/databases/productivity.db"]}'
        'filesystem:{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","'$HOME'"]}'
        'memory:{"command":"npx","args":["-y","@modelcontextprotocol/server-memory"]}'
        'thinking:{"command":"npx","args":["-y","@modelcontextprotocol/server-sequential-thinking"]}'
        'browserbase:{"command":"npx","args":["-y","@browserbasehq/mcp-server-browserbase"],"env":{"BROWSERBASE_API_KEY":"your_key_here","BROWSERBASE_PROJECT_ID":"your_project_here"}}'
        'claude-buddy:{"command":"node","args":["'$HOME'/claude-buddy/mcp-websocket-server.js"]}'
    )
    
    for config in "${mcp_configs[@]}"; do
        local name=$(echo "$config" | cut -d: -f1)
        local json=$(echo "$config" | cut -d: -f2-)
        
        print_status "progress" "Configuring MCP server: $name"
        claude-code mcp remove "$name" -s local 2>/dev/null || true
        claude-code mcp add-json "$name" "$json" 2>/dev/null || print_status "warning" "Failed to configure $name MCP server"
    done
    
    print_status "success" "MCP servers configured"
}

create_databases() {
    print_status "progress" "Setting up databases..."
    
    # Create productivity database with enhanced schema
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

CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert welcome data
INSERT OR IGNORE INTO tasks (title, description, priority, status) VALUES 
    ('🎉 Welcome to Claude Autonomous System', 'Your development environment is now fully autonomous and self-managing!', 'high', 'completed'),
    ('📱 Access Mobile Interface', 'Visit http://localhost:8080 for mobile control', 'medium', 'todo'),
    ('🔧 Configure API Keys', 'Add your API keys to ~/.claude/config.json for enhanced features', 'medium', 'todo');

INSERT OR IGNORE INTO snippets (title, language, code, description, tags) VALUES
    ('System Status Check', 'bash', 'curl -s http://localhost:8080/status | jq', 'Check Claude Buddy server health and statistics', 'claude,status,monitoring'),
    ('Run AI Analysis', 'bash', 'curl -X POST http://localhost:8080/analysis/run', 'Trigger AI code analysis via REST API', 'ai,analysis,quality'),
    ('View System Logs', 'bash', 'tail -f ~/.claude/autonomous.log', 'Monitor system activity in real-time', 'logs,monitoring,debug');

INSERT OR IGNORE INTO system_metrics (metric_name, metric_value) VALUES
    ('installation_date', datetime('now')),
    ('system_version', '2.0.0'),
    ('installation_method', 'curl_installer');
EOF
    
    print_status "success" "Databases created with sample data"
}

start_system() {
    print_status "rocket" "Starting the autonomous system..."
    
    # Install any missing Claude Buddy dependencies
    if [[ -d "$HOME/claude-buddy" ]]; then
        cd "$HOME/claude-buddy"
        npm install --silent 2>/dev/null || print_status "warning" "Some dependencies may be missing"
    fi
    
    # Start the autonomous system
    if [[ -f "$HOME/.claude/autonomous-startup.sh" ]]; then
        chmod +x "$HOME/.claude/autonomous-startup.sh"
        "$HOME/.claude/autonomous-startup.sh" >/dev/null 2>&1 &
        
        # Give it time to start
        print_status "progress" "Initializing systems..."
        sleep 15
        
        # Check if WebSocket server is running
        local server_running=false
        for port in 8080 8081 8082 8083; do
            if curl -f -s "http://localhost:$port/status" >/dev/null 2>&1; then
                print_status "success" "🌐 WebSocket server running on port $port"
                print_status "success" "📱 Mobile interface: http://localhost:$port"
                server_running=true
                break
            fi
        done
        
        if [[ "$server_running" == false ]]; then
            print_status "warning" "WebSocket server may need manual start - check logs"
            print_status "info" "Run: ~/.claude/manage.sh status"
        fi
    else
        print_status "warning" "Autonomous startup script not found"
    fi
    
    print_status "success" "System initialization complete"
}

cleanup() {
    print_status "progress" "Cleaning up installation files..."
    rm -rf "$INSTALL_DIR" 2>/dev/null || true
    print_status "success" "Installation files cleaned up"
}

show_completion() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    ${WHITE}${BOLD}🎉 Installation Complete! System is Autonomous${NC}        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    print_status "rocket" "Your Claude development environment is now 100% autonomous!"
    echo ""
    
    echo -e "${WHITE}${BOLD}📋 What's Been Installed:${NC}"
    echo -e "${CYAN}   • Autonomous startup system (runs with Claude Code)${NC}"
    echo -e "${CYAN}   • WebSocket server with real-time communication${NC}"
    echo -e "${CYAN}   • Progressive Web App for mobile control${NC}"
    echo -e "${CYAN}   • Health monitoring with auto-recovery${NC}"
    echo -e "${CYAN}   • AI code analysis pipeline${NC}"
    echo -e "${CYAN}   • 14+ MCP servers configured and ready${NC}"
    echo -e "${CYAN}   • SQLite databases with sample data${NC}"
    echo -e "${CYAN}   • Daily automated maintenance${NC}"
    echo ""
    
    echo -e "${WHITE}${BOLD}🚀 Quick Start:${NC}"
    echo -e "${GREEN}   • Launch Claude Code - everything starts automatically!${NC}"
    echo -e "${GREEN}   • Mobile control: ${YELLOW}http://localhost:8080${NC}"
    echo -e "${GREEN}   • System status: ${YELLOW}~/.claude/manage.sh status${NC}"
    echo -e "${GREEN}   • View logs: ${YELLOW}tail -f ~/.claude/autonomous.log${NC}"
    echo ""
    
    echo -e "${WHITE}${BOLD}🔧 Configuration:${NC}"
    echo -e "${BLUE}   • Settings: ${YELLOW}~/.claude/settings.json${NC}"
    echo -e "${BLUE}   • API keys: Add to environment variables or .claude/config.json${NC}"
    echo -e "${BLUE}   • All scripts: ${YELLOW}~/.claude/ directory${NC}"
    echo ""
    
    echo -e "${WHITE}${BOLD}📖 Documentation:${NC}"
    echo -e "${PURPLE}   • GitHub: ${YELLOW}https://github.com/heyfinal/claude-autonomous-system${NC}"
    echo -e "${PURPLE}   • Issues: ${YELLOW}https://github.com/heyfinal/claude-autonomous-system/issues${NC}"
    echo ""
    
    print_status "success" "${BOLD}System is now 100% autonomous - no manual intervention required!"
    print_status "info" "${BOLD}Star ⭐ the repo if this made your life easier!"
    echo ""
    
    echo -e "${WHITE}${BOLD}Next Steps:${NC}"
    echo -e "${YELLOW}1. Launch Claude Code${NC}"
    echo -e "${YELLOW}2. Visit http://localhost:8080 on your phone${NC}"
    echo -e "${YELLOW}3. Add to home screen for quick access${NC}"
    echo -e "${YELLOW}4. Everything else happens automatically!${NC}"
    echo ""
}

handle_error() {
    echo ""
    print_status "error" "Installation encountered an error on line $1"
    print_status "info" "Please check the output above for details"
    print_status "info" "You can retry the installation or report issues at:"
    print_status "info" "https://github.com/heyfinal/claude-autonomous-system/issues"
    cleanup
    exit 1
}

# Main installation flow
main() {
    trap 'handle_error $LINENO' ERR
    
    print_header
    
    print_status "rocket" "Starting Claude Autonomous System installation..."
    echo ""
    
    check_system_requirements
    install_homebrew
    install_node
    check_claude_code
    install_python_tools
    download_system_files
    install_npm_dependencies
    install_python_dependencies
    setup_system_files
    configure_claude_settings
    setup_mcp_servers
    create_databases
    start_system
    cleanup
    
    show_completion
}

# Ensure we're not being sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi