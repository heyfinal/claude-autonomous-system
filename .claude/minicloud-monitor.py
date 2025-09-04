#!/usr/bin/env python3
"""
Minicloud MCP Server Connectivity Monitor
Automatically checks and troubleshoots connectivity to minicloud MCP servers
"""
import subprocess
import json
import time
import sys
from typing import List, Dict, Any

MINICLOUD_IP = "192.168.2.2"
SSH_KEY_PATH = "/Users/daniel/.ssh/minicloud_key"
MINICLOUD_USER = "daniel"

PROFESSIONAL_MCP_SERVERS = {
    # Frontend & UI/UX
    "react-mcp": 8201,
    "nextjs-mcp": 8202, 
    "vue-mcp": 8203,
    
    # E-commerce & Marketplace
    "stripe-mcp": 8210,
    "shopify-mcp": 8211,
    "commerce-mcp": 8212,
    "auth0-mcp": 8213,
    
    # macOS Development
    "sketch-mcp": 8221,
    "electron-mcp": 8222,
    "macos-notarize": 8223,
    
    # JavaScript & Node.js Suite
    "typescript-mcp": 8230,
    "vite-mcp": 8231,
    "webpack-mcp": 8232,
    "eslint-mcp": 8233,
    
    # Modern Web Frameworks
    "astro-mcp": 8240,
    "svelte-mcp": 8241,
    "remix-mcp": 8242,
    "nuxt-mcp": 8243,
    
    # Design & Prototyping
    "storybook-mcp": 8250,
    "framer-mcp": 8251,
    "three-mcp": 8252,
    "gsap-mcp": 8253
}

def run_command(command: str, timeout: int = 10) -> tuple[bool, str]:
    """Run shell command with timeout"""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.returncode == 0, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return False, "Command timed out"
    except Exception as e:
        return False, str(e)

def check_minicloud_connectivity() -> bool:
    """Check if minicloud server is reachable via SSH"""
    command = f"ssh -i {SSH_KEY_PATH} -o ConnectTimeout=5 {MINICLOUD_USER}@{MINICLOUD_IP} 'echo connected'"
    success, output = run_command(command)
    return success and "connected" in output

def check_mcp_server_status(server_name: str, port: int) -> Dict[str, Any]:
    """Check if specific MCP server is running"""
    command = f"ssh -i {SSH_KEY_PATH} {MINICLOUD_USER}@{MINICLOUD_IP} 'docker ps --filter name={server_name} --format \"{{.Status}}\"'"
    success, output = run_command(command)
    
    status = {
        "name": server_name,
        "port": port,
        "running": False,
        "status": "unknown",
        "url": f"http://{MINICLOUD_IP}:{port}"
    }
    
    if success and output.strip():
        status["running"] = "Up" in output
        status["status"] = output.strip()
    
    return status

def restart_failed_servers(failed_servers: List[str]) -> bool:
    """Restart failed MCP servers"""
    if not failed_servers:
        return True
    
    server_list = " ".join(failed_servers)
    command = f"ssh -i {SSH_KEY_PATH} {MINICLOUD_USER}@{MINICLOUD_IP} 'docker restart {server_list}'"
    success, output = run_command(command, timeout=60)
    
    if success:
        print(f"✅ Restarted servers: {', '.join(failed_servers)}")
        time.sleep(5)  # Wait for restart
        return True
    else:
        print(f"❌ Failed to restart servers: {output}")
        return False

def generate_connectivity_report() -> Dict[str, Any]:
    """Generate comprehensive connectivity report"""
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "minicloud_accessible": check_minicloud_connectivity(),
        "servers": [],
        "summary": {
            "total_servers": len(PROFESSIONAL_MCP_SERVERS),
            "running": 0,
            "failed": 0,
            "failed_servers": []
        }
    }
    
    if not report["minicloud_accessible"]:
        print(f"❌ HALT: Cannot connect to minicloud server at {MINICLOUD_IP}")
        print("🔧 Please check:")
        print("   - Network connectivity")
        print("   - SSH key permissions")
        print("   - Minicloud server status")
        return report
    
    print(f"✅ Connected to minicloud server at {MINICLOUD_IP}")
    
    for server_name, port in PROFESSIONAL_MCP_SERVERS.items():
        status = check_mcp_server_status(server_name, port)
        report["servers"].append(status)
        
        if status["running"]:
            report["summary"]["running"] += 1
            print(f"✅ {server_name} (:{port}) - Running")
        else:
            report["summary"]["failed"] += 1
            report["summary"]["failed_servers"].append(server_name)
            print(f"❌ {server_name} (:{port}) - Failed/Stopped")
    
    return report

def main():
    """Main connectivity check and repair function"""
    print("🔍 Checking minicloud MCP server connectivity...")
    
    report = generate_connectivity_report()
    
    if not report["minicloud_accessible"]:
        sys.exit(1)
    
    if report["summary"]["failed"] > 0:
        print(f"\n⚠️  {report['summary']['failed']} servers need attention")
        
        # Attempt to restart failed servers
        if restart_failed_servers(report["summary"]["failed_servers"]):
            print("✅ Restart attempt completed. Re-checking status...")
            time.sleep(10)
            
            # Re-check after restart
            final_report = generate_connectivity_report()
            still_failed = final_report["summary"]["failed"]
            
            if still_failed == 0:
                print("🎉 All servers now running!")
            else:
                print(f"⚠️  {still_failed} servers still need manual attention")
                for server in final_report["summary"]["failed_servers"]:
                    print(f"   - {server}")
        else:
            print("❌ Could not restart servers. Manual intervention required.")
            sys.exit(1)
    else:
        print(f"\n🎉 All {report['summary']['total_servers']} MCP servers are running!")
    
    # Save report
    with open("/Users/daniel/.claude/minicloud-status.json", "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📊 Status report saved to ~/.claude/minicloud-status.json")

if __name__ == "__main__":
    main()