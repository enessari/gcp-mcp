import { Transport } from "@modelcontextprotocol/sdk/transport/index.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import WebSocket from "ws";

export class WebSocketTransport implements Transport {
  private ws: WebSocket;
  private messageHandlers: Array<(message: JSONRPCMessage) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as JSONRPCMessage;
        this.messageHandlers.forEach(handler => handler(message));
      } catch (error) {
        this.errorHandlers.forEach(handler => 
          handler(new Error(`Failed to parse message: ${error}`))
        );
      }
    });

    this.ws.on('close', () => {
      this.closeHandlers.forEach(handler => handler());
    });

    this.ws.on('error', (error: Error) => {
      this.errorHandlers.forEach(handler => handler(error));
    });
  }

  async start(): Promise<void> {
    if (this.ws.readyState === WebSocket.CONNECTING) {
      await new Promise((resolve, reject) => {
        this.ws.once('open', resolve);
        this.ws.once('error', reject);
      });
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    return new Promise((resolve, reject) => {
      this.ws.send(JSON.stringify(message), (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  onMessage(handler: (message: JSONRPCMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      
      this.ws.once('close', () => resolve());
      this.ws.close();
    });
  }
}