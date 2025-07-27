import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebSocketTransport } from './websocket-transport.js';
import { createExtendedServer } from './index-extended.js';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'gcp-mcp-extended',
    version: '1.1.0',
    uptime: process.uptime()
  });
});

// Authentication middleware
const authenticateRequest = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  
  try {
    // For Cloud Run, we can verify the token is a valid identity token
    // In production, you might want to verify against specific service accounts
    // For now, we'll do basic validation
    if (!token || token.length < 10) {
      throw new Error('Invalid token');
    }
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get SSH private key from Secret Manager
async function getSSHPrivateKey(): Promise<string> {
  const client = new SecretManagerServiceClient();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  
  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable not set');
  }

  const [version] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/gcp-mcp-ssh-private-key/versions/latest`,
  });

  const payload = version.payload?.data?.toString();
  if (!payload) {
    throw new Error('SSH private key not found in Secret Manager');
  }

  return payload;
}

// Initialize SSH key on startup
let sshPrivateKey: string | undefined;
getSSHPrivateKey()
  .then(key => {
    sshPrivateKey = key;
    process.env.SSH_PRIVATE_KEY = key;
    console.log('SSH private key loaded from Secret Manager');
  })
  .catch(error => {
    console.error('Failed to load SSH private key:', error);
  });

// WebSocket connection handling
wss.on('connection', async (ws, req) => {
  console.log('New WebSocket connection');
  
  try {
    // Create MCP server instance
    const mcpServer = await createExtendedServer();
    
    // Create WebSocket transport
    const transport = new WebSocketTransport(ws);
    
    // Connect server to transport
    await mcpServer.connect(transport);
    
    console.log('MCP server connected via WebSocket');
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
    
  } catch (error) {
    console.error('Error setting up MCP server:', error);
    ws.close();
  }
});

// REST endpoint for single request/response (alternative to WebSocket)
app.post('/mcp/request', authenticateRequest, async (req, res) => {
  try {
    const { method, params } = req.body;
    
    // Create a temporary MCP server instance
    const mcpServer = await createExtendedServer();
    
    // Handle the request directly
    // This would need to be implemented based on the specific method
    // For now, return a placeholder response
    res.json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      result: {
        message: 'REST endpoint implementation pending',
        method,
        params
      }
    });
    
  } catch (error) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`GCP MCP Extended server listening on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`REST endpoint: http://localhost:${PORT}/mcp/request`);
});