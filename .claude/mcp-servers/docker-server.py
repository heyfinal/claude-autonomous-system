#!/usr/bin/env python3
"""
Docker MCP Server - Custom implementation for Docker container management
"""
import asyncio
import json
import sys
from typing import Any, Dict, List, Optional
import docker
from docker.errors import DockerException


class DockerMCPServer:
    def __init__(self):
        self.client = None
        try:
            self.client = docker.from_env()
            self.client.ping()  # Test connection
        except DockerException as e:
            print(f"Docker connection failed: {e}", file=sys.stderr)

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        method = request.get("method")
        params = request.get("params", {})
        
        if method == "tools/list":
            return {
                "tools": [
                    {
                        "name": "docker_ps",
                        "description": "List running Docker containers"
                    },
                    {
                        "name": "docker_images", 
                        "description": "List Docker images"
                    },
                    {
                        "name": "docker_run",
                        "description": "Run a Docker container"
                    },
                    {
                        "name": "docker_stop",
                        "description": "Stop a Docker container"
                    },
                    {
                        "name": "docker_logs",
                        "description": "Get container logs"
                    }
                ]
            }
        
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            
            if not self.client:
                return {"error": "Docker client not available"}
            
            try:
                if tool_name == "docker_ps":
                    containers = self.client.containers.list()
                    result = []
                    for container in containers:
                        result.append({
                            "id": container.short_id,
                            "name": container.name,
                            "status": container.status,
                            "image": container.image.tags[0] if container.image.tags else "unknown"
                        })
                    return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
                
                elif tool_name == "docker_images":
                    images = self.client.images.list()
                    result = []
                    for image in images:
                        result.append({
                            "id": image.short_id,
                            "tags": image.tags,
                            "size": image.attrs.get("Size", 0)
                        })
                    return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
                
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
                    return {"content": [{"type": "text", "text": f"Container started: {container.short_id}"}]}
                
                elif tool_name == "docker_stop":
                    container_id = arguments.get("container_id")
                    container = self.client.containers.get(container_id)
                    container.stop()
                    return {"content": [{"type": "text", "text": f"Container stopped: {container_id}"}]}
                
                elif tool_name == "docker_logs":
                    container_id = arguments.get("container_id")
                    tail = arguments.get("tail", 100)
                    container = self.client.containers.get(container_id)
                    logs = container.logs(tail=tail).decode('utf-8')
                    return {"content": [{"type": "text", "text": logs}]}
                    
            except Exception as e:
                return {"error": f"Docker operation failed: {str(e)}"}
        
        return {"error": "Unknown method"}

async def main():
    server = DockerMCPServer()
    
    while True:
        try:
            line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
            if not line:
                break
                
            request = json.loads(line.strip())
            response = await server.handle_request(request)
            print(json.dumps(response))
            sys.stdout.flush()
            
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            sys.stdout.flush()

if __name__ == "__main__":
    asyncio.run(main())