import { Tool } from "@modelcontextprotocol/sdk/types";
import { z } from "zod";
import { SSHTools } from "./ssh-tools";

export const SSH_TOOLS: Tool[] = [
  {
    name: "ssh-connect-vm",
    description: "Connect to a Google Compute Engine VM via SSH",
    inputSchema: z.object({
      projectId: z.string().describe("GCP project ID"),
      zone: z.string().describe("GCP zone where the VM is located"),
      instanceName: z.string().describe("Name of the VM instance"),
    }).strict(),
  },
  {
    name: "ssh-execute-command",
    description: "Execute a command on a connected VM via SSH",
    inputSchema: z.object({
      command: z.string().describe("Command to execute on the VM"),
    }).strict(),
  },
  {
    name: "ssh-query-database",
    description: "Query a database through SSH tunnel",
    inputSchema: z.object({
      dbType: z.enum(["mysql", "postgresql"]).describe("Type of database"),
      host: z.string().describe("Database host (localhost for SSH tunnel)"),
      port: z.number().describe("Database port"),
      database: z.string().describe("Database name"),
      username: z.string().describe("Database username"),
      password: z.string().describe("Database password"),
      query: z.string().describe("SQL query to execute"),
    }).strict(),
  },
  {
    name: "ssh-create-tunnel",
    description: "Create an SSH tunnel to a remote service",
    inputSchema: z.object({
      localPort: z.number().describe("Local port to bind"),
      remoteHost: z.string().describe("Remote host to tunnel to"),
      remotePort: z.number().describe("Remote port to tunnel to"),
    }).strict(),
  },
  {
    name: "ssh-disconnect",
    description: "Disconnect the current SSH session",
    inputSchema: z.object({}).strict(),
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