#!/usr/bin/env bash
# Deploy the BACKEND (API) to Google Cloud Run. Run in Google Cloud Shell from the repository root:
#
#   export PROJECT_ID="your-gcp-project-id"
#   export MONGODB_URI='mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority'
#   export ADMIN_EMAIL="you@yourschool.org"
#   export ADMIN_PASSWORD='a long password, at least 10 characters'
#   bash deploy/deploy-backend.sh
#
# Safe to run again. Secrets go to Secret Manager; nothing secret is in the code or the image.
set -euo pipefail
: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-asia-south1}"                    # Mumbai. Use the region closest to your MongoDB cluster.
SERVICE="${BACKEND_SERVICE:-skolar-backend}"

gcloud config set project "$PROJECT_ID" >/dev/null
echo "1/5  Turning on the Google services we need..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com

put_secret() { if gcloud secrets describe "$1" >/dev/null 2>&1; then printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null; else printf '%s' "$2" | gcloud secrets create "$1" --replication-policy=automatic --data-file=- >/dev/null; fi; }
has_secret() { gcloud secrets describe "$1" >/dev/null 2>&1; }

echo "2/5  Storing secrets in Secret Manager..."
[ -n "${MONGODB_URI:-}" ] && put_secret skolar-mongodb-uri "$MONGODB_URI"
has_secret skolar-mongodb-uri || { echo "MONGODB_URI is required the first time."; exit 1; }
has_secret skolar-jwt-secret || put_secret skolar-jwt-secret "$(openssl rand -hex 32)"
has_secret skolar-enroll-key || put_secret skolar-enroll-key "$(openssl rand -hex 24)"
[ -n "${ADMIN_PASSWORD:-}" ] && put_secret skolar-admin-password "$ADMIN_PASSWORD"

echo "3/5  Letting Cloud Run read those secrets..."
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUN_SA="${RUN_SA:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"
for s in skolar-mongodb-uri skolar-jwt-secret skolar-enroll-key skolar-admin-password; do
  has_secret "$s" && gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:$RUN_SA" --role=roles/secretmanager.secretAccessor >/dev/null
done

echo "4/5  Building and deploying the backend (about 2-4 minutes)..."
SECRETS="MONGODB_URI=skolar-mongodb-uri:latest,JWT_SECRET=skolar-jwt-secret:latest,ENROLL_KEY=skolar-enroll-key:latest"
ENVV="NODE_ENV=production,MONGODB_DB=${MONGODB_DB:-skolar}"
if has_secret skolar-admin-password && [ -n "${ADMIN_EMAIL:-}" ]; then SECRETS="$SECRETS,ADMIN_PASSWORD=skolar-admin-password:latest"; ENVV="$ENVV,ADMIN_EMAIL=$ADMIN_EMAIL"; fi
[ -n "${FRONTEND_ORIGINS:-}" ] && ENVV="$ENVV,FRONTEND_ORIGINS=$FRONTEND_ORIGINS"
gcloud run deploy "$SERVICE" --source backend --region "$REGION" --allow-unauthenticated \
  --set-env-vars "$ENVV" --set-secrets "$SECRETS" \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 --concurrency 80 --timeout 60

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo
echo "5/5  Backend is live:  $URL"
echo "  Health check:   $URL/status"
echo "  Next: deploy the frontend with   API_URL=$URL bash deploy/deploy-frontend.sh"
echo "  Device enrollment key (for the apps; keep private):"
echo "      gcloud secrets versions access latest --secret=skolar-enroll-key"
