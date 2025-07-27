#!/usr/bin/env node

import { spawn } from 'child_process';
import WebSocket from 'ws';
import readline from 'readline';

/**
 * Claude Desktop MCP Client for Cloud Run
 * This client bridges Claude Desktop's stdio interface with Cloud Run's WebSocket endpoint
 */

const CLOUD_RUN_URL = process.env.GCP_MCP_URL || 'wss://gcp-mcp-xxxxx-uc.a.run.app';
const AUTH_TOKEN = process.env.GCP_MCP_TOKEN || '';

class CloudRunMCPClient {
  private ws?: WebSocket;
  private rl: readline.Interface;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.error('Connecting to Cloud Run MCP server...');
      
      this.ws = new WebSocket(CLOUD_RUN_URL, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });

      this.ws.on('open', () => {
        console.error('Connected to Cloud Run MCP server');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        resolve();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        reject(error);
      });

      this.ws.on('close', () => {
        console.error('WebSocket connection closed');
        this.handleReconnect();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          // Forward to stdout for Claude Desktop
          console.log(JSON.stringify(message));
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });
    });
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Exiting.');
      process.exit(1);
    }

    this.reconnectAttempts++;
    console.error(`Reconnecting in ${this.reconnectDelay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
        this.setupStdinHandler();
      } catch (error) {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
      }
    }, this.reconnectDelay);
  }

  setupStdinHandler(): void {
    // Read from stdin (Claude Desktop)
    this.rl.on('line', (line) => {
      try {
        const message = JSON.parse(line);
        
        // Forward to WebSocket
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(message));
        } else {
          console.error('WebSocket not connected');
        }
      } catch (error) {
        console.error('Error parsing stdin:', error);
      }
    });
  }

  async start(): Promise<void> {
    try {
      // Get auth token if not provided
      if (!AUTH_TOKEN) {
        console.error('Getting GCP identity token...');
        const token = await this.getIdentityToken();
        process.env.GCP_MCP_TOKEN = token;
      }

      await this.connect();
      this.setupStdinHandler();
    } catch (error) {
      console.error('Failed to start client:', error);
      process.exit(1);
    }
  }

  private async getIdentityToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('gcloud', ['auth', 'print-identity-token']);
      let token = '';
      
      proc.stdout.on('data', (data) => {
        token += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(token.trim());
        } else {
          reject(new Error('Failed to get identity token'));
        }
      });
    });
  }
}

// Start the client
const client = new CloudRunMCPClient();
client.start().catch(console.error);