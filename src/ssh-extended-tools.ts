import { Tool } from "@modelcontextprotocol/sdk/types";
import { SSHTools } from "./ssh-tools";

export const SSH_TOOLS: Tool[] = [
  {
    name: "ssh-connect-vm",
    description: "Connect to a Google Compute Engine VM via SSH",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "GCP project ID" },
        zone: { type: "string", description: "GCP zone where the VM is located" },
        instanceName: { type: "string", description: "Name of the VM instance" },
      },
      required: ["projectId", "zone", "instanceName"],
    },
  },
  {
    name: "ssh-execute-command",
    description: "Execute a command on a connected VM via SSH",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command to execute on the VM" },
      },
      required: ["command"],
    },
  },
  {
    name: "ssh-query-database",
    description: "Query a database through SSH tunnel",
    inputSchema: {
      type: "object",
      properties: {
        dbType: { type: "string", enum: ["mysql", "postgresql"], description: "Type of database" },
        host: { type: "string", description: "Database host (localhost for SSH tunnel)" },
        port: { type: "number", description: "Database port" },
        database: { type: "string", description: "Database name" },
        username: { type: "string", description: "Database username" },
        password: { type: "string", description: "Database password" },
        query: { type: "string", description: "SQL query to execute" },
      },
      required: ["dbType", "host", "port", "database", "username", "password", "query"],
    },
  },
  {
    name: "ssh-create-tunnel",
    description: "Create an SSH tunnel to a remote service",
    inputSchema: {
      type: "object",
      properties: {
        localPort: { type: "number", description: "Local port to bind" },
        remoteHost: { type: "string", description: "Remote host to tunnel to" },
        remotePort: { type: "number", description: "Remote port to tunnel to" },
      },
      required: ["localPort", "remoteHost", "remotePort"],
    },
  },
  {
    name: "ssh-disconnect",
    description: "Disconnect the current SSH session",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

export class SSHToolHandlers {
  private sshTools: SSHTools;

  constructor() {
    this.sshTools = new SSHTools();
  }

  async handleSSHConnect(args: any) {
    const { projectId, zone, instanceName } = args;
    await this.sshTools.connectToVM(projectId, zone, instanceName);
    return { success: true, message: `Connected to VM ${instanceName}` };
  }

  async handleSSHExecute(args: any) {
    const { command } = args;
    const result = await this.sshTools.executeCommand(command);
    return { success: true, output: result };
  }

  async handleSSHQueryDatabase(args: any) {
    const { dbType, host, port, database, username, password, query } = args;
    const result = await this.sshTools.queryDatabase(
      dbType,
      host,
      port,
      database,
      username,
      password,
      query
    );
    return { success: true, result };
  }

  async handleSSHCreateTunnel(args: any) {
    const { localPort, remoteHost, remotePort } = args;
    await this.sshTools.createSSHTunnel(localPort, remoteHost, remotePort);
    return { 
      success: true, 
      message: `SSH tunnel created: localhost:${localPort} -> ${remoteHost}:${remotePort}` 
    };
  }

  async handleSSHDisconnect() {
    await this.sshTools.disconnect();
    return { success: true, message: "SSH session disconnected" };
  }
}