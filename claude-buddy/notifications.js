#!/usr/bin/env node
/**
 * Claude Buddy Real-time Notification System
 * Monitor system events and send notifications via WebSocket
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

class NotificationSystem {
  constructor(websocketUrl = 'ws://localhost:8080') {
    this.websocketUrl = websocketUrl;
    this.ws = null;
    this.watchers = new Map();
    this.isConnected = false;
    this.notifications = [];
  }

  connect() {
    this.ws = new WebSocket(this.websocketUrl);
    
    this.ws.on('open', () => {
      console.log('✓ Notification system connected to Claude Buddy');
      this.isConnected = true;
      this.ws.send(JSON.stringify({
        type: 'set_name',
        name: 'NotificationSystem'
      }));
      this.startMonitoring();
    });
    
    this.ws.on('close', () => {
      console.log('Notification system disconnected');
      this.isConnected = false;
      // Auto-reconnect
      setTimeout(() => this.connect(), 5000);
    });
    
    this.ws.on('error', (error) => {
      console.error('Notification WebSocket error:', error.message);
    });
  }

  sendNotification(type, message, metadata = {}) {
    const notification = {
      type: 'notification',
      notificationType: type,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      source: 'NotificationSystem'
    };
    
    this.notifications.push(notification);
    
    if (this.isConnected) {
      this.ws.send(JSON.stringify(notification));
    }
    
    // Also log to console
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    return notification;
  }

  startMonitoring() {
    // Monitor file changes in project directories
    this.watchDirectory('/Users/daniel/claude-buddy', 'project');
    this.watchDirectory('/Users/daniel/scripts', 'scripts');
    this.watchDirectory('/Users/daniel/databases', 'databases');
    
    // Monitor system resources
    this.monitorSystemResources();
    
    // Monitor GitHub notifications (simulated)
    this.monitorGitHub();
    
    // Monitor MCP server status
    this.monitorMCPServers();
    
    console.log('Started monitoring system...');
  }

  watchDirectory(directory, category) {
    if (!fs.existsSync(directory)) {
      return;
    }
    
    try {
      const watcher = fs.watch(directory, { recursive: true }, (eventType, filename) => {
        if (filename && !filename.includes('node_modules') && !filename.includes('.git')) {
          this.sendNotification('file_change', `File ${eventType}: ${filename}`, {
            category,
            directory,
            filename,
            eventType
          });
        }
      });
      
      this.watchers.set(directory, watcher);
      console.log(`Watching directory: ${directory}`);
      
    } catch (error) {
      console.error(`Failed to watch ${directory}:`, error.message);
    }
  }

  monitorSystemResources() {
    setInterval(() => {
      try {
        const memory = process.memoryUsage();
        const memoryUsageMB = Math.round(memory.rss / 1024 / 1024);
        
        // Get system uptime
        const uptime = Math.floor(process.uptime());
        
        // Check disk space
        const diskInfo = execSync('df -h /', { encoding: 'utf8' });
        const diskLine = diskInfo.split('\n')[1];
        const diskUsage = diskLine.split(/\s+/)[4];
        
        // Send resource update
        this.sendNotification('system_stats', 'System resource update', {
          memory: { rss: memoryUsageMB, ...memory },
          uptime,
          diskUsage,
          timestamp: new Date().toISOString()
        });
        
        // Alert if memory usage is high
        if (memoryUsageMB > 500) {
          this.sendNotification('warning', `High memory usage: ${memoryUsageMB}MB`, {
            type: 'memory',
            value: memoryUsageMB
          });
        }
        
        // Alert if disk usage is high
        const diskPercent = parseInt(diskUsage);
        if (diskPercent > 80) {
          this.sendNotification('warning', `High disk usage: ${diskUsage}`, {
            type: 'disk',
            value: diskPercent
          });
        }
        
      } catch (error) {
        console.error('Error monitoring system resources:', error.message);
      }
    }, 60000); // Every minute
  }

  monitorGitHub() {
    setInterval(async () => {
      try {
        // In production, this would check actual GitHub notifications
        // For now, we'll simulate some events
        const events = [
          'New issue opened',
          'Pull request approved',
          'Code review requested',
          'Release published'
        ];
        
        // Randomly trigger GitHub events (10% chance)
        if (Math.random() < 0.1) {
          const randomEvent = events[Math.floor(Math.random() * events.length)];
          this.sendNotification('github', randomEvent, {
            source: 'github',
            repository: 'anthropics/claude-code',
            action: randomEvent.toLowerCase().replace(/\s+/g, '_')
          });
        }
        
      } catch (error) {
        console.error('Error monitoring GitHub:', error.message);
      }
    }, 30000); // Every 30 seconds
  }

  monitorMCPServers() {
    setInterval(async () => {
      try {
        // Check MCP server health
        const result = execSync('claude-code mcp list', { 
          encoding: 'utf8',
          timeout: 10000 
        });
        
        const lines = result.split('\n');
        const serverStatuses = lines
          .filter(line => line.includes(' - '))
          .map(line => {
            const match = line.match(/^(.+?): .+ - (.+)$/);
            if (match) {
              return {
                name: match[1].trim(),
                status: match[2].trim()
              };
            }
            return null;
          })
          .filter(Boolean);
        
        const connectedCount = serverStatuses.filter(s => s.status === '✓ Connected').length;
        const failedCount = serverStatuses.filter(s => s.status === '✗ Failed to connect').length;
        
        this.sendNotification('mcp_status', `MCP Servers: ${connectedCount} connected, ${failedCount} failed`, {
          connectedCount,
          failedCount,
          servers: serverStatuses
        });
        
        // Alert on server failures
        if (failedCount > 0) {
          const failedServers = serverStatuses
            .filter(s => s.status === '✗ Failed to connect')
            .map(s => s.name);
          
          this.sendNotification('warning', `MCP servers failed: ${failedServers.join(', ')}`, {
            type: 'mcp_failure',
            failedServers
          });
        }
        
      } catch (error) {
        console.error('Error monitoring MCP servers:', error.message);
      }
    }, 120000); // Every 2 minutes
  }

  // Cleanup method
  stop() {
    console.log('Stopping notification system...');
    
    // Close file watchers
    this.watchers.forEach((watcher) => {
      watcher.close();
    });
    this.watchers.clear();
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
    }
  }

  // Get notification history
  getNotifications(limit = 50) {
    return this.notifications.slice(-limit);
  }
}

// Export for programmatic use
module.exports = NotificationSystem;

// Run if executed directly
if (require.main === module) {
  const notificationSystem = new NotificationSystem();
  notificationSystem.connect();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down notification system...');
    notificationSystem.stop();
    process.exit(0);
  });
  
  // Send startup notification
  setTimeout(() => {
    notificationSystem.sendNotification('info', 'Claude Buddy Notification System started', {
      pid: process.pid,
      startTime: new Date().toISOString()
    });
  }, 2000);
}