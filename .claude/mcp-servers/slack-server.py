#!/usr/bin/env python3
"""
Slack MCP Server - Custom implementation for Slack operations
"""
import asyncio
import json
import sys
import os
from typing import Any, Dict, List, Optional
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError


class SlackMCPServer:
    def __init__(self):
        self.client = None
        token = os.getenv('SLACK_BOT_TOKEN')
        if token:
            self.client = WebClient(token=token)

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        method = request.get("method")
        params = request.get("params", {})
        
        if method == "tools/list":
            return {
                "tools": [
                    {
                        "name": "slack_send_message",
                        "description": "Send message to Slack channel"
                    },
                    {
                        "name": "slack_list_channels", 
                        "description": "List Slack channels"
                    },
                    {
                        "name": "slack_get_messages",
                        "description": "Get messages from Slack channel"
                    },
                    {
                        "name": "slack_upload_file",
                        "description": "Upload file to Slack"
                    },
                    {
                        "name": "slack_get_users",
                        "description": "Get list of Slack users"
                    }
                ]
            }
        
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            
            if not self.client:
                return {"error": "Slack client not configured - set SLACK_BOT_TOKEN"}
            
            try:
                if tool_name == "slack_send_message":
                    channel = arguments.get("channel")
                    text = arguments.get("text")
                    
                    response = self.client.chat_postMessage(
                        channel=channel,
                        text=text
                    )
                    
                    return {"content": [{"type": "text", "text": f"Message sent to {channel}"}]}
                
                elif tool_name == "slack_list_channels":
                    response = self.client.conversations_list(
                        types="public_channel,private_channel"
                    )
                    
                    channels = []
                    for channel in response["channels"]:
                        channels.append({
                            "id": channel["id"],
                            "name": channel["name"],
                            "is_private": channel["is_private"],
                            "num_members": channel.get("num_members", 0)
                        })
                    
                    return {"content": [{"type": "text", "text": json.dumps(channels, indent=2)}]}
                
                elif tool_name == "slack_get_messages":
                    channel = arguments.get("channel")
                    limit = arguments.get("limit", 10)
                    
                    response = self.client.conversations_history(
                        channel=channel,
                        limit=limit
                    )
                    
                    messages = []
                    for message in response["messages"]:
                        messages.append({
                            "user": message.get("user", "unknown"),
                            "text": message.get("text", ""),
                            "ts": message.get("ts")
                        })
                    
                    return {"content": [{"type": "text", "text": json.dumps(messages, indent=2)}]}
                
                elif tool_name == "slack_upload_file":
                    channels = arguments.get("channels")
                    file_path = arguments.get("file_path")
                    title = arguments.get("title", "")
                    
                    response = self.client.files_upload_v2(
                        channels=channels,
                        file=file_path,
                        title=title
                    )
                    
                    return {"content": [{"type": "text", "text": f"File uploaded: {title}"}]}
                
                elif tool_name == "slack_get_users":
                    response = self.client.users_list()
                    
                    users = []
                    for user in response["members"]:
                        if not user.get("deleted", False):
                            users.append({
                                "id": user["id"],
                                "name": user["name"],
                                "real_name": user.get("real_name", ""),
                                "is_bot": user.get("is_bot", False)
                            })
                    
                    return {"content": [{"type": "text", "text": json.dumps(users, indent=2)}]}
                        
            except SlackApiError as e:
                return {"error": f"Slack API error: {e.response['error']}"}
            except Exception as e:
                return {"error": f"Slack operation failed: {str(e)}"}
        
        return {"error": "Unknown method"}

async def main():
    server = SlackMCPServer()
    
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