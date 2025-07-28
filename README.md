# GCP MCP Extended - Cloud Run Edition

A Model Context Protocol (MCP) server that enables AI assistants like Claude to interact with your Google Cloud Platform environment through Cloud Run deployment. This version includes SSH access to VMs and database query capabilities through secure tunnels.

## 🚀 Key Features

* ☁️ **Cloud Run Deployment**: Scalable, serverless deployment
* 🔐 **SSH VM Access**: Connect to Compute Engine VMs via SSH
* 🗄️ **Database Queries**: Query MySQL/PostgreSQL through SSH tunnels
* 🌐 **WebSocket Support**: Real-time communication with Claude Desktop
* 🔒 **Secure Authentication**: GCP identity tokens and Secret Manager
* 🏗️ **CI/CD Pipeline**: Automated deployment with Cloud Build
* 📊 **Full GCP Integration**: Compute, Storage, BigQuery, Cloud SQL, GKE, and more

## Prerequisites

* Google Cloud Project with billing enabled
* gcloud CLI installed and authenticated
* Node.js 18+ and npm
* Claude Desktop application
* GitHub account (for CI/CD)

## 🛠️ Quick Start

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/enessari/gcp-mcp.git
cd gcp-mcp

# Set your project ID
export PROJECT_ID="your-project-id"
export REGION="us-central1"
```

### Step 2: Run Setup Script

```bash
# Make script executable
chmod +x setup-gcp.sh

# Run setup (this will enable APIs, create service accounts, etc.)
./setup-gcp.sh $PROJECT_ID $REGION
```

This script will:
- ✅ Enable required GCP APIs
- ✅ Create service account with necessary permissions
- ✅ Generate SSH keys and store in Secret Manager
- ✅ Create Artifact Registry for container images

### Step 3: Connect GitHub to Cloud Build

1. Go to [GCP Console](https://console.cloud.google.com)
2. Navigate to **Cloud Build > Triggers**
3. Click **Connect Repository**
4. Select **GitHub** and authorize
5. Choose repository: `enessari/gcp-mcp`
6. Click **Connect**

### Step 4: Create Build Trigger

1. In Cloud Build Triggers, click **Create Trigger**
2. Configure:
   - **Name**: `gcp-mcp-trigger`
   - **Event**: Push to a branch
   - **Branch**: `^main$`
   - **Build Configuration**: `/cloudbuild.yaml`
   - **Substitution Variables**:
     - `_REGION`: `us-central1`
     - `_SERVICE_ACCOUNT`: `gcp-mcp-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com`
3. Click **Create**

### Step 5: Deploy to Cloud Run

The deployment will start automatically when you push to main. To trigger manually:

```bash
# Check build status
gcloud builds list --limit=1

# View build logs
gcloud builds log $(gcloud builds list --limit=1 --format="value(id)")
```

### Step 6: Get Cloud Run URL

```bash
# Wait for deployment to complete, then get URL
gcloud run services describe gcp-mcp --region=$REGION --format='value(status.url)'
```

### Step 7: Build Client Locally

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Step 8: Configure Claude Desktop

1. Open Claude Desktop config:
   - macOS: `~/.claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add this configuration (replace URL with your Cloud Run URL):

```json
{
  "mcpServers": {
    "gcp-mcp": {
      "command": "node",
      "args": [
        "/path/to/gcp-mcp/dist/src/claude-desktop-client.js"
      ],
      "env": {
        "GCP_MCP_URL": "wss://gcp-mcp-XXXXX-uc.a.run.app"
      }
    }
  }
}
```

3. Restart Claude Desktop

## 📝 Available Tools

### Original GCP Tools
- `list-projects`: List all accessible GCP projects
- `select-project`: Select a GCP project for operations
- `get-billing-info`: Get billing information
- `get-cost-forecast`: Get cost forecast
- `list-gke-clusters`: List GKE clusters
- `list-sql-instances`: List Cloud SQL instances
- `get-logs`: Get Cloud Logging entries
- `run-gcp-code`: Execute custom GCP API calls

### SSH & Database Tools
- `ssh-connect-vm`: Connect to a VM via SSH
- `ssh-execute-command`: Execute commands on VMs
- `ssh-query-database`: Query databases through SSH tunnel
- `ssh-create-tunnel`: Create SSH tunnels
- `ssh-disconnect`: Disconnect SSH session

## 💡 Usage Examples

### Basic GCP Operations
```
List all my GCP projects
Select project my-production-project
Show me all Cloud Run services in us-central1
What's my current billing status?
```

### VM Management
```
Connect to VM web-server-1 in zone us-central1-a
Execute command: systemctl status nginx
Execute command: df -h && free -m
Show me the last 100 lines of /var/log/nginx/error.log
```

### Database Queries
```
Connect to VM database-proxy in zone us-central1-a
Create SSH tunnel to localhost:3306
Query MySQL database production: SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL 1 DAY;
```

### Combined Operations
```
# Check web server and database status
Connect to VM web-server-1 in zone us-central1-a
Execute command: curl -s http://localhost/health
Create SSH tunnel to database.local:5432
Query PostgreSQL database app_db: SELECT version();
```

## 🔧 Troubleshooting

### Build Failures
```bash
# Check build logs
gcloud builds log $(gcloud builds list --limit=1 --format="value(id)")

# Check Cloud Run logs
gcloud run services logs read gcp-mcp --region=$REGION --limit=50
```

### SSH Connection Issues
```bash
# Verify SSH key exists
gcloud secrets versions access latest --secret=gcp-mcp-ssh-private-key

# Add public key to project metadata
gcloud secrets versions access latest --secret=gcp-mcp-ssh-public-key > /tmp/key.pub
gcloud compute project-info add-metadata --metadata-from-file ssh-keys=/tmp/key.pub
```

### Authentication Issues
```bash
# Re-authenticate
gcloud auth login
gcloud auth application-default login

# Check service account
gcloud iam service-accounts describe gcp-mcp-sa@$PROJECT_ID.iam.gserviceaccount.com
```

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│ Claude Desktop  │────▶│  Cloud Run       │────▶│ GCP Resources  │
│                 │     │  (MCP Server)    │     │                │
│ - stdio/WebSocket     │  - Express/WS    │     │ - Compute VMs  │
│ - MCP Client     │     │  - SSH Tools     │     │ - Cloud SQL    │
│                 │     │  - GCP APIs      │     │ - BigQuery     │
└─────────────────┘     └──────────────────┘     └────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │ Secret Manager   │
                        │ (SSH Keys)       │
                        └──────────────────┘
```

## 🔒 Security

- **Authentication**: Uses GCP identity tokens
- **SSH Keys**: Stored in Secret Manager, never exposed
- **Network**: All traffic encrypted (HTTPS/WSS)
- **IAM**: Least privilege service account
- **Secrets**: No credentials in code or logs

## 💰 Cost Estimation

- **Cloud Run**: ~$0.10-0.50/day (scales to zero)
- **Secret Manager**: ~$0.06/month
- **Cloud Build**: ~$0.003/build minute
- **Total**: ~$5-20/month for typical usage

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT
