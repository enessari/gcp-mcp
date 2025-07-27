# GCP MCP Extended - Cloud Run Deployment Guide

## Overview
This guide walks through deploying the extended GCP MCP server with SSH and database query capabilities to Google Cloud Run.

## Prerequisites
- Google Cloud Project with billing enabled
- gcloud CLI installed and authenticated
- GitHub account (for CI/CD)
- Claude Desktop installed

## Setup Steps

### 1. Initial GCP Setup
```bash
# Set your project ID
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# Run the setup script
./setup-gcp.sh $PROJECT_ID $REGION
```

### 2. Fork and Configure Repository
1. Fork this repository to your GitHub account
2. Clone your forked repository
3. Update the repository URL in package.json

### 3. Connect GitHub to Cloud Build
1. Go to Cloud Build Triggers in GCP Console
2. Click "Connect Repository"
3. Select GitHub and authenticate
4. Choose your forked repository
5. Create a trigger:
   - Name: `gcp-mcp-trigger`
   - Event: Push to branch
   - Branch: `^main$`
   - Build configuration: `/cloudbuild.yaml`

### 4. Configure SSH Access for VMs
The setup script creates an SSH key stored in Secret Manager. To use it:

1. Add the public key to VM metadata:
```bash
# Get the public key
gcloud secrets versions access latest --secret="gcp-mcp-ssh-public-key" > /tmp/key.pub

# Add to project metadata (applies to all VMs)
gcloud compute project-info add-metadata \
  --metadata-from-file ssh-keys=/tmp/key.pub
```

2. Or add to specific VMs:
```bash
gcloud compute instances add-metadata INSTANCE_NAME \
  --zone=ZONE \
  --metadata-from-file ssh-keys=/tmp/key.pub
```

### 5. Deploy to Cloud Run
Push to main branch to trigger deployment:
```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

### 6. Configure Claude Desktop

After deployment, get your Cloud Run URL:
```bash
gcloud run services describe gcp-mcp --region=$REGION --format='value(status.url)'
```

Update `~/.claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "gcp-mcp": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-H", "Authorization: Bearer $(gcloud auth print-identity-token)",
        "-d", "@-",
        "YOUR_CLOUD_RUN_URL/mcp"
      ]
    }
  }
}
```

## Security Considerations

### SSH Access
- SSH private keys are stored in Secret Manager
- Service account has restricted compute access
- Consider using OS Login for additional security

### Database Access
- Use Cloud SQL Proxy for production databases
- Store database credentials in Secret Manager
- Use IAM database authentication when possible

### Network Security
- Configure VPC Service Controls
- Use Private Google Access for internal traffic
- Implement proper firewall rules

## Available Tools

### Original GCP Tools
- `list-projects`: List all GCP projects
- `select-project`: Select active project
- `get-billing-info`: Get billing information
- `list-gke-clusters`: List GKE clusters
- `list-sql-instances`: List Cloud SQL instances
- `get-logs`: Get Cloud Logging entries
- `run-gcp-code`: Execute custom GCP API calls

### Extended SSH Tools
- `ssh-connect-vm`: Connect to a VM via SSH
- `ssh-execute-command`: Execute commands on VMs
- `ssh-query-database`: Query databases through SSH tunnel
- `ssh-create-tunnel`: Create SSH tunnels
- `ssh-disconnect`: Disconnect SSH session

## Usage Examples

### Connect to VM and check status
```
Connect to VM instance-1 in zone us-central1-a
Execute command: df -h
```

### Query database through SSH tunnel
```
Create SSH tunnel to Cloud SQL instance on port 3306
Query MySQL database: SELECT * FROM users LIMIT 10;
```

### Check logs and run diagnostics
```
Show me the last 50 error logs from my application
Connect to the web server VM and check nginx status
```

## Troubleshooting

### Cloud Run Issues
- Check logs: `gcloud run services logs read gcp-mcp --region=$REGION`
- Verify service account permissions
- Ensure all required APIs are enabled

### SSH Connection Issues
- Verify SSH keys are properly configured
- Check VM firewall rules allow SSH (port 22)
- Ensure service account has compute.instanceAdmin role

### Database Connection Issues
- Verify Cloud SQL has public IP or use Cloud SQL Proxy
- Check database user permissions
- Ensure SSL/TLS is properly configured

## Monitoring

Set up monitoring alerts:
```bash
# CPU utilization alert
gcloud monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="GCP MCP High CPU" \
  --condition-display-name="CPU > 80%" \
  --condition-filter='resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/container/cpu/utilizations"' \
  --condition-comparison=COMPARISON_GT \
  --condition-threshold-value=0.8
```

## Cost Optimization

- Use Cloud Run's scale-to-zero feature
- Set appropriate CPU and memory limits
- Configure maximum instances to prevent runaway costs
- Use Cloud Scheduler to warm up instances if needed