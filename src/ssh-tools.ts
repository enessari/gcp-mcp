import { NodeSSH } from 'node-ssh';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const compute = google.compute('v1');

export class SSHTools {
  private auth: GoogleAuth;
  private ssh: NodeSSH;

  constructor() {
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/compute'],
    });
    this.ssh = new NodeSSH();
  }

  async connectToVM(projectId: string, zone: string, instanceName: string) {
    try {
      // Get instance metadata
      const authClient = await this.auth.getClient();
      const res = await compute.instances.get({
        auth: authClient as any,
        project: projectId,
        zone: zone,
        instance: instanceName,
      });

      const instance = res.data;
      const externalIP = instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
      
      if (!externalIP) {
        throw new Error('No external IP found for instance');
      }

      // Get SSH key from metadata
      const sshKeys = instance.metadata?.items?.find((item: any) => item.key === 'ssh-keys')?.value;
      
      // Connect via SSH
      await this.ssh.connect({
        host: externalIP,
        username: 'default', // This should be configurable
        privateKey: process.env.SSH_PRIVATE_KEY || '', // Should be provided securely
      });

      return this.ssh;
    } catch (error) {
      console.error('SSH connection error:', error);
      throw error;
    }
  }

  async executeCommand(command: string): Promise<string> {
    try {
      const result = await this.ssh.execCommand(command);
      if (result.stderr) {
        console.error('Command stderr:', result.stderr);
      }
      return result.stdout;
    } catch (error) {
      console.error('Command execution error:', error);
      throw error;
    }
  }

  async queryDatabase(
    dbType: 'mysql' | 'postgresql',
    host: string,
    port: number,
    database: string,
    username: string,
    password: string,
    query: string
  ): Promise<any> {
    let command: string;
    
    switch (dbType) {
      case 'mysql':
        command = `mysql -h ${host} -P ${port} -u ${username} -p${password} ${database} -e "${query}"`;
        break;
      case 'postgresql':
        command = `PGPASSWORD='${password}' psql -h ${host} -p ${port} -U ${username} -d ${database} -c "${query}"`;
        break;
      default:
        throw new Error('Unsupported database type');
    }

    return await this.executeCommand(command);
  }

  async createSSHTunnel(
    localPort: number,
    remoteHost: string,
    remotePort: number
  ): Promise<void> {
    try {
      await this.ssh.forwardOut(
        '127.0.0.1',
        localPort,
        remoteHost,
        remotePort
      );
      console.log(`SSH tunnel created: localhost:${localPort} -> ${remoteHost}:${remotePort}`);
    } catch (error) {
      console.error('SSH tunnel creation error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.ssh.isConnected()) {
      this.ssh.dispose();
    }
  }
}