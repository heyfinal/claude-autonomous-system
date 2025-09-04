# CLAUDE.md - Development Standards & Best Practices

## CORE IMPROVEMENTS IMPLEMENTED

### 1. SwiftAI Library Integration (2025)
**Location**: `~/SwiftAI-Library/`
**Purpose**: Unified LLM integration for iOS/macOS projects

**When to use SwiftAI:**
- Any Swift project requiring LLM integration
- Projects needing both on-device and cloud AI models
- Applications requiring structured AI outputs

**Example usage:**
```swift
import SwiftAI

// Automatic fallback from on-device to cloud
let llm: any LLM = SystemLLM.ifAvailable ?? OpenaiLLM(model: "gpt-4", apiKey: apiKey)

// Structured output with type safety
let answer = try await llm.complete("Solve: 2x + 5 = 13")
```

**Benefits:**
- Eliminates custom OpenAI integration bugs
- Provides proven error handling
- Supports model-agnostic development
- Handles API timeouts and retries automatically

### 2. MCP Roots Protocol Support
**Purpose**: Prevent path/permission failures in MCP servers

**All MCP servers now include:**
- Roots protocol declaration
- Path availability validation
- Dynamic roots updates
- Proper JSONRPC 2.0 formatting

**Example MCP server structure:**
```python
# Initialize with roots support
capabilities = {
    "tools": {},
    "roots": {"listChanged": True}
}

# Validate paths before operations
if not os.path.exists(path):
    return error_response
```

## QUALITY STANDARDS

### Swift/iOS Development
- **ALWAYS** use SwiftAI for LLM integration
- **NEVER** manually implement OpenAI API calls
- **CHECK** threading with `@MainActor` for UI operations
- **USE** `ScreenCaptureKit` with proper permission handling

### MCP Server Development
- **IMPLEMENT** roots protocol in all servers
- **VALIDATE** paths before file operations
- **USE** proper JSONRPC 2.0 response format
- **HANDLE** Docker/SSH connection failures gracefully

### Architecture Patterns
- **START** with minimal working version
- **TEST** on target platform before deployment
- **INCLUDE** all dependencies in deployment
- **VERIFY** with actual user permissions

## INSTALLED MCP SERVERS (2025)

### Database Integration
- **sqlite-server**: Local SQLite database queries (`~/databases/`)
- **postgres-server**: PostgreSQL database connection and queries
- **github-server**: GitHub repository management and API access
- **git-server**: Local Git repository operations

### Web Scraping & Automation  
- **fetch-server**: Web content fetching and conversion
- **brave-search-server**: Web search capabilities
- **browserbase-server**: Browser automation in the cloud
- **web-browser-server**: Web browser control and automation
- **puppeteer**: Browser automation (pre-existing)

### Business Integration
- **slack-server**: Slack messaging and workspace integration
- **google-drive-server**: Google Drive file access and management

### Development Tools
- **memory**: Knowledge graph and context management (pre-existing)
- **thinking**: Sequential reasoning for complex problems (pre-existing)
- **filesystem**: File operations and management (pre-existing)

### Usage Examples
```bash
# Query databases with natural language
"Find all users in the SQLite database who signed up last week"

# Web automation
"Use browserbase to fill out the QuickBooks payroll form with employee data"

# GitHub integration  
"Create a new repository and push the CheatSheet v2 project"

# Business workflows
"Send a Slack message when the build completes and save logs to Google Drive"
```

## KNOWN SOLUTIONS

### Common Issues & Fixes

#### Threading Crashes (Swift)
```swift
// Wrong
class Manager {
    init() { window = NSWindow() }  // Crash
}

// Correct
@MainActor
class Manager {
    @MainActor init() { window = NSWindow() }
}
```

#### MCP Server Hangs
```python
# Wrong - hangs waiting for input
while True:
    line = sys.stdin.readline()

# Correct - proper async handling
async def main():
    while True:
        line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
        if not line:
            break
```

#### Permission Detection (macOS)
```swift
// Use proper permission checking
if !AXIsProcessTrusted() {
    // Request permission, don't loop
    AXTrustedCheckOptionPrompt.takeRetainedValue() as String: true
}
```

## DEVELOPMENT WORKFLOW

1. **Check existing solutions first**
   - SwiftAI for LLM features
   - MCP registry for server capabilities
   - Established libraries over custom code

2. **Validate architecture early**
   - Test threading model
   - Verify permission handling
   - Check cross-platform compatibility

3. **Implement incrementally**
   - Start with core functionality
   - Add features with testing
   - Document working configurations

## TESTING REQUIREMENTS

- **Local testing**: Verify basic functionality
- **Clean environment**: Test without cached dependencies
- **Permission testing**: Run with target user account
- **Cross-platform**: Validate on deployment target OS

## DEPLOYMENT CHECKLIST

- [ ] All dependencies included
- [ ] Paths are relative, not absolute
- [ ] Permissions documented
- [ ] Error handling implemented
- [ ] Fallback strategies in place
- [ ] Tested on target platform

---
Last Updated: 2025-08-31
Next Update: When new patterns or solutions are discovered