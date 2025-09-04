#!/usr/bin/env python3
"""
Docker MCP Server V2 - With roots protocol support for better path handling
"""
import asyncio
import json
import sys
import os
from typing import Any, Dict, List, Optional
import docker
from docker.errors import DockerException


class DockerMCPServer:
    def __init__(self):
        self.client = None
        self.roots = []
        self.supports_roots = False
        
        # Initialize Docker client
        try:
            self.client = docker.from_env()
            self.client.ping()  # Test connection
        except DockerException as e:
            print(json.dumps({
                "jsonrpc": "2.0",
                "method": "notifications/message",
                "params": {
                    "level": "error",
                    "message": f"Docker connection failed: {e}"
                }
            }), file=sys.stderr)
            sys.stderr.flush()

    async def handle_initialize(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle initialization with roots protocol support"""
        client_info = params.get("clientInfo", {})
        capabilities = params.get("capabilities", {})
        
        # Check if client supports roots
        if capabilities.get("roots"):
            self.supports_roots = True
            
        response = {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {},
                "roots": {
                    "listChanged": True
                }
            },
            "serverInfo": {
                "name": "docker-mcp-server-v2",
                "version": "2.0.0"
            }
        }
        
        return response

    async def handle_roots_list(self) -> Dict[str, Any]:
        """Handle roots/list request"""
        roots = []
        
        # Add Docker socket if available
        if os.path.exists("/var/run/docker.sock"):
            roots.append({
                "uri": "file:///var/run/docker.sock",
                "name": "Docker Socket"
            })
            
        # Add Docker config directory if exists
        docker_config = os.path.expanduser("~/.docker")
        if os.path.exists(docker_config):
            roots.append({
                "uri": f"file://{docker_config}",
                "name": "Docker Config"
            })
            
        self.roots = roots
        return {"roots": roots}

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Main request handler with roots protocol support"""
        method = request.get("method")
        params = request.get("params", {})
        request_id = request.get("id")
        
        try:
            # Handle initialization
            if method == "initialize":
                result = await self.handle_initialize(params)
                
                # Request roots after initialization if supported
                if self.supports_roots:
                    # Send async notification to request roots
                    asyncio.create_task(self.request_roots())
                    
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": result
                }
            
            # Handle roots protocol
            elif method == "roots/list":
                result = await self.handle_roots_list()
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": result
                }
            
            # Handle notifications
            elif method == "notifications/roots/list_changed":
                # Update our roots when client notifies us
                await self.handle_roots_list()
                return {}  # No response for notifications
            
            elif method == "tools/list":
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "tools": [
                            {
                                "name": "docker_ps",
                                "description": "List running Docker containers",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "all": {
                                            "type": "boolean",
                                            "description": "Show all containers (not just running)"
                                        }
                                    }
                                }
                            },
                            {
                                "name": "docker_images", 
                                "description": "List Docker images",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {}
                                }
                            },
                            {
                                "name": "docker_run",
                                "description": "Run a Docker container",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "image": {
                                            "type": "string",
                                            "description": "Docker image to run"
                                        },
                                        "command": {
                                            "type": "string",
                                            "description": "Command to execute"
                                        },
                                        "detach": {
                                            "type": "boolean",
                                            "description": "Run in detached mode"
                                        }
                                    },
                                    "required": ["image"]
                                }
                            },
                            {
                                "name": "docker_stop",
                                "description": "Stop a Docker container",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "container_id": {
                                            "type": "string",
                                            "description": "Container ID or name"
                                        }
                                    },
                                    "required": ["container_id"]
                                }
                            },
                            {
                                "name": "docker_logs",
                                "description": "Get container logs",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "container_id": {
                                            "type": "string",
                                            "description": "Container ID or name"
                                        },
                                        "tail": {
                                            "type": "integer",
                                            "description": "Number of lines to show from end"
                                        }
                                    },
                                    "required": ["container_id"]
                                }
                            },
                            {
                                "name": "list_roots",
                                "description": "List available Docker roots/paths",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {}
                                }
                            }
                        ]
                    }
                }
            
            elif method == "tools/call":
                tool_name = params.get("name")
                arguments = params.get("arguments", {})
                
                if tool_name == "list_roots":
                    roots_info = f"Available roots: {len(self.roots)}\n"
                    for root in self.roots:
                        roots_info += f"- {root['name']}: {root['uri']}\n"
                    
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "content": [{"type": "text", "text": roots_info}]
                        }
                    }
                
                if not self.client:
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "error": {
                            "code": -32603,
                            "message": "Docker client not available"
                        }
                    }
                
                try:
                    if tool_name == "docker_ps":
                        show_all = arguments.get("all", False)
                        containers = self.client.containers.list(all=show_all)
                        result = []
                        for container in containers:
                            result.append({
                                "id": container.short_id,
                                "name": container.name,
                                "status": container.status,
                                "image": container.image.tags[0] if container.image.tags else "unknown"
                            })
                        return {
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "result": {
                                "content": [{"type": "text", "text": json.dumps(result, indent=2)}]
                            }
                        }
                    
                    elif tool_name == "docker_images":
                        images = self.client.images.list()
                        result = []
                        for image in images:
                            result.append({
                                "id": image.short_id,
                                "tags": image.tags,
                                "size": image.attrs.get("Size", 0)
                            })
                        return {
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "result": {
                                "content": [{"type": "text", "text": json.dumps(result, indent=2)}]
                            }
                        }
                    
                    elif tool_name == "docker_run":
                        image = arguments.get("image")
                        command = arguments.get("command")
                        detach = arguments.get("detach", True)
                        
                        container = self.client.containers.run(
                            image, 
                            command, 
                            detach=detach,
                            remove=not detach
                        )
                        return {
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "result": {
                                "content": [{"type": "text", "text": f"Container started: {container.short_id}"}]
                            }
                        }
                    
                    elif tool_name == "docker_stop":
                        container_id = arguments.get("container_id")
                        container = self.client.containers.get(container_id)
                        container.stop()
                        return {
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "result": {
                                "content": [{"type": "text", "text": f"Container stopped: {container_id}"}]
                            }
                        }
                    
                    elif tool_name == "docker_logs":
                        container_id = arguments.get("container_id")
                        tail = arguments.get("tail", 100)
                        container = self.client.containers.get(container_id)
                        logs = container.logs(tail=tail).decode('utf-8')
                        return {
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "result": {
                                "content": [{"type": "text", "text": logs}]
                            }
                        }
                        
                except Exception as e:
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "error": {
                            "code": -32603,
                            "message": f"Docker operation failed: {str(e)}"
                        }
                    }
            
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32601,
                    "message": f"Unknown method: {method}"
                }
            }
            
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }

    async def request_roots(self):
        """Send request for roots list"""
        await asyncio.sleep(0.1)  # Small delay to ensure client is ready
        request = {
            "jsonrpc": "2.0",
            "method": "roots/list",
            "id": "roots-1"
        }
        print(json.dumps(request))
        sys.stdout.flush()

async def main():
    server = DockerMCPServer()
    
    # Print initialization message
    print(json.dumps({
        "jsonrpc": "2.0",
        "method": "notifications/message",
        "params": {
            "level": "info",
            "message": "Docker MCP Server V2 started with roots protocol support"
        }
    }), file=sys.stderr)
    sys.stderr.flush()
    
    while True:
        try:
            line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
            if not line:
                break
                
            request = json.loads(line.strip())
            response = await server.handle_request(request)
            
            if response:  # Don't print empty responses (notifications)
                print(json.dumps(response))
                sys.stdout.flush()
            
        except json.JSONDecodeError as e:
            error_response = {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32700,
                    "message": f"Parse error: {str(e)}"
                }
            }
            print(json.dumps(error_response))
            sys.stdout.flush()
        except Exception as e:
            error_response = {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": f"Internal error: {str(e)}"
                }
            }
            print(json.dumps(error_response))
            sys.stdout.flush()

if __name__ == "__main__":
    asyncio.run(main())