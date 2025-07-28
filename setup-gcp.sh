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

# Check if region is in EU and warn
if [[ "$REGION" == eu-* ]]; then
  echo -e "${YELLOW}Warning: EU regions may have organization policies. Trying US region if EU fails.${NC}"
  FALLBACK_REGION="us-central1"
fi

echo -e "${GREEN}Setting up GCP MCP Server on Cloud Run${NC}"
echo -e "${YELLOW}Project ID: $PROJECT_ID${NC}"
echo -e "${YELLOW}Region: $REGION${NC}"

# Set default project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${GREEN}Enabling required APIs...${NC}"
APIS=(
  "compute.googleapis.com"
  "cloudbuild.googleapis.com"
  "run.googleapis.com"
  "artifactregistry.googleapis.com"
  "cloudresourcemanager.googleapis.com"
  "container.googleapis.com"
  "sqladmin.googleapis.com"
  "logging.googleapis.com"
  "storage.googleapis.com"
  "bigquery.googleapis.com"
  "cloudfunctions.googleapis.com"
  "secretmanager.googleapis.com"
)

for api in "${APIS[@]}"; do
  echo "Enabling $api..."
  gcloud services enable $api || echo -e "${YELLOW}Warning: Failed to enable $api${NC}"
done

# Check if service account already exists
echo -e "${GREEN}Checking service account...${NC}"
if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" &>/dev/null; then
  echo -e "${YELLOW}Service account already exists${NC}"
else
  echo -e "${GREEN}Creating service account...${NC}"
  gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="GCP MCP Service Account" \
    --description="Service account for GCP MCP Server"
fi

SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Grant necessary permissions with error handling
echo -e "${GREEN}Granting IAM permissions...${NC}"

ROLES=(
  "roles/compute.instanceAdmin.v1"
  "roles/compute.osLogin"
  "roles/storage.admin"
  "roles/bigquery.admin"
  "roles/cloudsql.admin"
  "roles/container.admin"
  "roles/logging.admin"
  "roles/cloudfunctions.admin"
  "roles/run.admin"
  "roles/secretmanager.secretAccessor"
  "roles/cloudresourcemanager.projectViewer"
)

for role in "${ROLES[@]}"; do
  echo "Granting $role..."
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="$role" \
    --condition=None 2>/dev/null || echo -e "${YELLOW}Warning: Could not grant $role${NC}"
done

# Create SSH key for VM access (stored in Secret Manager)
echo -e "${GREEN}Setting up SSH keys...${NC}"

# Check if secret already exists
if gcloud secrets describe gcp-mcp-ssh-private-key &>/dev/null; then
  echo -e "${YELLOW}SSH private key secret already exists${NC}"
else
  echo -e "${GREEN}Creating SSH key for VM access...${NC}"
  ssh-keygen -t rsa -b 4096 -f /tmp/gcp-mcp-ssh-key -N "" -C "$SERVICE_ACCOUNT_EMAIL"
  
  # Store SSH private key in Secret Manager
  gcloud secrets create gcp-mcp-ssh-private-key \
    --data-file=/tmp/gcp-mcp-ssh-key \
    --replication-policy="automatic"
  
  # Store public key for reference
  gcloud secrets create gcp-mcp-ssh-public-key \
    --data-file=/tmp/gcp-mcp-ssh-key.pub \
    --replication-policy="automatic"
  
  # Clean up temporary SSH keys
  rm -f /tmp/gcp-mcp-ssh-key /tmp/gcp-mcp-ssh-key.pub
fi

# Grant service account access to the secrets
echo -e "${GREEN}Granting access to secrets...${NC}"
gcloud secrets add-iam-policy-binding gcp-mcp-ssh-private-key \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor" 2>/dev/null || true

gcloud secrets add-iam-policy-binding gcp-mcp-ssh-public-key \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor" 2>/dev/null || true

# Create Artifact Registry repository for containers
echo -e "${GREEN}Setting up Artifact Registry...${NC}"
REPO_NAME="cloud-run-images"

# Try to create in the specified region first
if gcloud artifacts repositories describe $REPO_NAME --location=$REGION &>/dev/null; then
  echo -e "${YELLOW}Artifact Registry repository already exists in $REGION${NC}"
else
  echo -e "${GREEN}Creating Artifact Registry repository...${NC}"
  if ! gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Docker images for Cloud Run" 2>/dev/null; then
    
    # If failed and we have a fallback region, try that
    if [ ! -z "$FALLBACK_REGION" ]; then
      echo -e "${YELLOW}Failed to create in $REGION, trying $FALLBACK_REGION...${NC}"
      REGION=$FALLBACK_REGION
      
      if gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION \
        --description="Docker images for Cloud Run"; then
        echo -e "${GREEN}Successfully created in $REGION${NC}"
        echo -e "${YELLOW}Note: Update your Cloud Build trigger to use region: $REGION${NC}"
      else
        echo -e "${RED}Failed to create Artifact Registry. You may need to create it manually.${NC}"
        echo -e "${YELLOW}Try: gcloud artifacts repositories create $REPO_NAME --repository-format=docker --location=us-central1${NC}"
      fi
    else
      echo -e "${RED}Failed to create Artifact Registry. Check organization policies.${NC}"
    fi
  fi
fi

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Connect your GitHub repository to Cloud Build"
echo "2. Create a Cloud Build trigger:"
echo "   - Name: gcp-mcp-trigger"
echo "   - Event: Push to branch (main)"
echo "   - Source: Your repository"
echo "   - Build configuration: cloudbuild.yaml"
echo "   - Substitution variables:"
echo "     _REGION=$REGION"
echo "     _SERVICE_ACCOUNT=$SERVICE_ACCOUNT_EMAIL"
echo "3. Push code to trigger the build"
echo ""
echo -e "${GREEN}Service Account:${NC} $SERVICE_ACCOUNT_EMAIL"
echo -e "${GREEN}Artifact Registry:${NC} $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"
echo ""
echo -e "${YELLOW}Manual steps required:${NC}"
echo "- For billing APIs, grant 'Billing Account User' role in the Google Cloud Console"
echo "- Add SSH public key to VM metadata for SSH access"