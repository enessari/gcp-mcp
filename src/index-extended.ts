import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types";
import { SSH_TOOLS, SSHToolHandlers } from "./ssh-extended-tools";

// Import existing tools and handlers
// import { existingTools, existingHandlers } from "../index";

export async function createExtendedServer() {
  const server = new Server(
    {
      name: "gcp-mcp-extended",
      version: "1.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const sshHandlers = new SSHToolHandlers();

  // Register all tools (existing + SSH)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [...SSH_TOOLS],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // Handle SSH tools
      switch (name) {
        case "ssh-connect-vm":
          return await sshHandlers.handleSSHConnect(args);
        case "ssh-execute-command":
          return await sshHandlers.handleSSHExecute(args);
        case "ssh-query-database":
          return await sshHandlers.handleSSHQueryDatabase(args);
        case "ssh-create-tunnel":
          return await sshHandlers.handleSSHCreateTunnel(args);
        case "ssh-disconnect":
          return await sshHandlers.handleSSHDisconnect();
        default:
          // Fallback to existing handlers
          return {
            error: true,
            message: `Unknown tool: ${name}`,
          };
      }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });

  return server;
}

// For Cloud Run deployment
if (process.env.NODE_ENV === 'production') {
  import('express').then(({ default: express }) => {
    const app = express();
  const port = process.env.PORT || 8080;

  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'gcp-mcp-extended' });
  });

  // MCP WebSocket endpoint would go here
  // This requires additional setup for WebSocket support on Cloud Run

    app.listen(port, () => {
      console.log(`GCP MCP Extended server listening on port ${port}`);
    });
  });
} else {
  // Local development with stdio transport
  const transport = new StdioServerTransport();
  createExtendedServer().then(server => {
    server.connect(transport).catch(console.error);
  });
}