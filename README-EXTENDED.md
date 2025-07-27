# GCP MCP Extended - Cloud Run Deployment with SSH & Database Access

## Architecture Overview

This extended version of GCP MCP adds SSH access to VMs and database query capabilities through SSH tunnels. The architecture consists of:

1. **Cloud Run Service**: Hosts the MCP server with WebSocket support
2. **Claude Desktop Client**: Bridges Claude Desktop's stdio interface with Cloud Run's WebSocket endpoint
3. **SSH Tools**: Enable VM access and database queries through SSH tunnels
4. **Secret Manager**: Stores SSH private keys securely

## Features Added

### SSH VM Access
- Connect to any Compute Engine VM via SSH
- Execute commands remotely
- Full terminal access through Claude

### Database Query Support
- Query MySQL/PostgreSQL databases through SSH tunnels
- Secure connection without exposing database ports
- Support for complex SQL queries

### Cloud Run Deployment
- WebSocket support for real-time communication
- Auto-scaling with Cloud Run
- Secure authentication with identity tokens

## Quick Start

### 1. Setup GCP Environment
```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# Run setup script
chmod +x setup-gcp.sh
./setup-gcp.sh $PROJECT_ID $REGION
```

### 2. Deploy to Cloud Run
```bash
# Build and push container
gcloud builds submit --config cloudbuild.yaml

# Get Cloud Run URL
gcloud run services describe gcp-mcp --region=$REGION --format='value(status.url)'
```

### 3. Configure Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gcp-mcp": {
      "command": "node",
      "args": ["/path/to/gcp-mcp-project/dist/src/claude-desktop-client.js"],
      "env": {
        "GCP_MCP_URL": "wss://your-cloud-run-url"
      }
    }
  }
}
```

## Usage Examples

### VM Management
```
# Connect to a VM
Connect to VM instance-1 in zone us-central1-a

# Check system resources
Execute command: free -h && df -h

# View running processes
Execute command: ps aux | grep nginx

# Check logs
Execute command: tail -n 100 /var/log/syslog
```

### Database Queries
```
# Create SSH tunnel to database
Create SSH tunnel to localhost:3306 for MySQL database

# Query database
Query MySQL database myapp: SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL 1 DAY;

# Complex queries
Query PostgreSQL database analytics: 
SELECT 
  DATE(created_at) as date,
  COUNT(*) as signups,
  COUNT(CASE WHEN verified = true THEN 1 END) as verified
FROM users 
WHERE created_at > NOW() - INTERVAL 30 DAY
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Combined Operations
```
# Check application status and database
Connect to VM web-server-1 in zone us-central1-a
Execute command: systemctl status nginx
Create SSH tunnel to localhost:5432 for PostgreSQL
Query PostgreSQL database app_db: SELECT COUNT(*) FROM active_sessions;
```

## Security Best Practices

### SSH Key Management
- SSH keys are auto-generated and stored in Secret Manager
- Keys are never exposed in logs or environment variables
- Regular key rotation is recommended

### Network Security
- Use VPC Service Controls for additional security
- Configure firewall rules to restrict SSH access
- Enable OS Login for enhanced authentication

### Database Security
- Use Cloud SQL Proxy when possible
- Implement least-privilege database users
- Enable SSL/TLS for all database connections

## Troubleshooting

### Connection Issues
```bash
# Check Cloud Run logs
gcloud run services logs read gcp-mcp --region=$REGION --limit=50

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" \
  https://your-cloud-run-url
```

### SSH Issues
```bash
# Verify SSH key in Secret Manager
gcloud secrets versions access latest --secret=gcp-mcp-ssh-private-key

# Test SSH connection manually
gcloud compute ssh instance-name --zone=zone-name
```

### Database Connection Issues
- Ensure VM has network access to database
- Check database firewall rules
- Verify database credentials

## Performance Optimization

### Cloud Run Settings
- Memory: 2Gi (increase for heavy workloads)
- CPU: 2 (adjust based on usage)
- Max instances: 10 (prevent runaway costs)
- Timeout: 900s (for long-running operations)

### WebSocket Configuration
- Implement heartbeat to keep connections alive
- Use connection pooling for database queries
- Cache frequently accessed data

## Development

### Local Testing
```bash
# Install dependencies
npm install

# Run local server
npm run dev:server

# In another terminal, test client
npm run start:client
```

### Adding New Tools
1. Add tool definition in `src/ssh-extended-tools.ts`
2. Implement handler in `SSHToolHandlers` class
3. Update tool registration in server
4. Test locally before deploying

## Monitoring

### Metrics to Track
- WebSocket connection count
- SSH connection success rate
- Database query performance
- Error rates by operation type

### Alerts
Set up alerts for:
- High error rates
- Connection failures
- Resource exhaustion
- Security violations

## Cost Estimation

### Cloud Run
- CPU: ~$0.024/vCPU-hour
- Memory: ~$0.0025/GiB-hour
- Requests: $0.40/million
- WebSocket: Charged per minute of connection

### Secret Manager
- Secret versions: $0.06/10,000 accesses
- Storage: $0.06/secret/month

### Estimated Monthly Cost
- Light usage (100 requests/day): ~$5-10
- Medium usage (1000 requests/day): ~$20-50
- Heavy usage (10000 requests/day): ~$100-200

## Future Enhancements

- [ ] Add support for Windows VMs via RDP
- [ ] Implement file transfer capabilities
- [ ] Add support for container instances
- [ ] Create audit logs for all operations
- [ ] Add multi-region support
- [ ] Implement caching layer for frequent queries