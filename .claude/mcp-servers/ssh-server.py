#!/usr/bin/env python3
"""
SSH MCP Server - Custom implementation for SSH operations
"""
import asyncio
import json
import sys
from typing import Any, Dict, List, Optional
import paramiko
from paramiko import SSHClient, AutoAddPolicy


class SSHMCPServer:
    def __init__(self):
        self.connections = {}

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        method = request.get("method")
        params = request.get("params", {})
        
        if method == "tools/list":
            return {
                "tools": [
                    {
                        "name": "ssh_connect",
                        "description": "Connect to SSH server"
                    },
                    {
                        "name": "ssh_execute", 
                        "description": "Execute command on SSH server"
                    },
                    {
                        "name": "ssh_upload",
                        "description": "Upload file via SFTP"
                    },
                    {
                        "name": "ssh_download",
                        "description": "Download file via SFTP"
                    },
                    {
                        "name": "ssh_disconnect",
                        "description": "Disconnect from SSH server"
                    }
                ]
            }
        
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            
            try:
                if tool_name == "ssh_connect":
                    hostname = arguments.get("hostname")
                    username = arguments.get("username")
                    password = arguments.get("password")
                    key_filename = arguments.get("key_filename")
                    port = arguments.get("port", 22)
                    
                    client = SSHClient()
                    client.set_missing_host_key_policy(AutoAddPolicy())
                    
                    connect_kwargs = {
                        "hostname": hostname,
                        "port": port,
                        "username": username
                    }
                    
                    if key_filename:
                        connect_kwargs["key_filename"] = key_filename
                    elif password:
                        connect_kwargs["password"] = password
                    
                    await asyncio.get_event_loop().run_in_executor(
                        None, lambda: client.connect(**connect_kwargs)
                    )
                    
                    conn_id = f"{username}@{hostname}:{port}"
                    self.connections[conn_id] = client
                    
                    return {"content": [{"type": "text", "text": f"Connected to {conn_id}"}]}
                
                elif tool_name == "ssh_execute":
                    conn_id = arguments.get("connection_id")
                    command = arguments.get("command")
                    
                    if conn_id not in self.connections:
                        return {"error": f"No connection found: {conn_id}"}
                    
                    client = self.connections[conn_id]
                    stdin, stdout, stderr = client.exec_command(command)
                    
                    output = stdout.read().decode('utf-8')
                    error = stderr.read().decode('utf-8')
                    exit_code = stdout.channel.recv_exit_status()
                    
                    result = {
                        "exit_code": exit_code,
                        "stdout": output,
                        "stderr": error
                    }
                    
                    return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
                
                elif tool_name == "ssh_upload":
                    conn_id = arguments.get("connection_id")
                    local_path = arguments.get("local_path")
                    remote_path = arguments.get("remote_path")
                    
                    if conn_id not in self.connections:
                        return {"error": f"No connection found: {conn_id}"}
                    
                    client = self.connections[conn_id]
                    sftp = client.open_sftp()
                    sftp.put(local_path, remote_path)
                    sftp.close()
                    
                    return {"content": [{"type": "text", "text": f"Uploaded {local_path} to {remote_path}"}]}
                
                elif tool_name == "ssh_download":
                    conn_id = arguments.get("connection_id")
                    remote_path = arguments.get("remote_path")
                    local_path = arguments.get("local_path")
                    
                    if conn_id not in self.connections:
                        return {"error": f"No connection found: {conn_id}"}
                    
                    client = self.connections[conn_id]
                    sftp = client.open_sftp()
                    sftp.get(remote_path, local_path)
                    sftp.close()
                    
                    return {"content": [{"type": "text", "text": f"Downloaded {remote_path} to {local_path}"}]}
                
                elif tool_name == "ssh_disconnect":
                    conn_id = arguments.get("connection_id")
                    
                    if conn_id in self.connections:
                        self.connections[conn_id].close()
                        del self.connections[conn_id]
                        return {"content": [{"type": "text", "text": f"Disconnected from {conn_id}"}]}
                    else:
                        return {"error": f"No connection found: {conn_id}"}
                        
            except Exception as e:
                return {"error": f"SSH operation failed: {str(e)}"}
        
        return {"error": "Unknown method"}

async def main():
    server = SSHMCPServer()
    
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