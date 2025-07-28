#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${1:-"your-project-id"}
REGION=${2:-"us-central1"}
SERVICE_NAME="gcp-mcp"
SERVICE_ACCOUNT_NAME="gcp-mcp-sa"
REPO_NAME="gcp-mcp-repo"

echo -e "${GREEN}Setting up GCP MCP Server on Cloud Run${NC}"
echo -e "${YELLOW}Project ID: $PROJECT_ID${NC}"
echo -e "${YELLOW}Region: $REGION${NC}"

# Set default project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${GREEN}Enabling required APIs...${NC}"
gcloud services enable \
  compute.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudresourcemanager.googleapis.com \
  container.googleapis.com \
  sqladmin.googleapis.com \
  logging.googleapis.com \
  storage.googleapis.com \
  bigquery.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudbilling.googleapis.com \
  billingbudgets.googleapis.com \
  secretmanager.googleapis.com

# Create service account
echo -e "${GREEN}Creating service account...${NC}"
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
  --display-name="GCP MCP Service Account" \
  --description="Service account for GCP MCP Server"

# Grant necessary permissions
echo -e "${GREEN}Granting IAM permissions...${NC}"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Compute permissions for SSH access
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/compute.instanceAdmin.v1"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/compute.osLogin"

# Other GCP service permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/bigquery.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudsql.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/container.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/logging.admin"

# Billing viewer needs to be added at organization level
# For now, we'll skip this and add manually if needed
echo -e "${YELLOW}Note: Billing viewer role needs to be added manually at organization level${NC}"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudfunctions.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/run.admin"

# Create Cloud Build trigger (assuming GitHub connection exists)
echo -e "${GREEN}Creating Cloud Build trigger...${NC}"
echo -e "${YELLOW}Note: Make sure you've connected your GitHub repository to Cloud Build${NC}"

# Create SSH key for VM access (stored in Secret Manager)
echo -e "${GREEN}Creating SSH key for VM access...${NC}"
ssh-keygen -t rsa -b 4096 -f /tmp/gcp-mcp-ssh-key -N "" -C "$SERVICE_ACCOUNT_EMAIL"

# Store SSH private key in Secret Manager
gcloud secrets create gcp-mcp-ssh-private-key \
  --data-file=/tmp/gcp-mcp-ssh-key \
  --replication-policy="automatic"

# Grant service account access to the secret
gcloud secrets add-iam-policy-binding gcp-mcp-ssh-private-key \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor"

# Clean up temporary SSH keys
rm -f /tmp/gcp-mcp-ssh-key /tmp/gcp-mcp-ssh-key.pub

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Fork the repository to your GitHub account"
echo "2. Connect your GitHub repository to Cloud Build"
echo "3. Create a Cloud Build trigger:"
echo "   - Name: gcp-mcp-trigger"
echo "   - Event: Push to branch (main)"
echo "   - Source: Your forked repository"
echo "   - Build configuration: cloudbuild.yaml"
echo "4. Push code to trigger the build"
echo ""
echo -e "${GREEN}Service Account:${NC} $SERVICE_ACCOUNT_EMAIL"
echo -e "${GREEN}Cloud Run URL will be available after first deployment${NC}"