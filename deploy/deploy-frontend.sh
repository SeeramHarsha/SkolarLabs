#!/usr/bin/env bash
# Deploy the FRONTEND (web dashboard) to Google Cloud Run. Run in Cloud Shell from the repository root, after the backend:
#
#   export PROJECT_ID="your-gcp-project-id"
#   export API_URL="https://skolar-backend-xxxxx-el.a.run.app"       # printed by deploy-backend.sh
#   bash deploy/deploy-frontend.sh
#
# It then tells the backend the dashboard's address (so the browser is allowed to call it).
set -euo pipefail
: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-asia-south1}"
SERVICE="${FRONTEND_SERVICE:-skolar-frontend}"
BACKEND_SERVICE="${BACKEND_SERVICE:-skolar-backend}"

gcloud config set project "$PROJECT_ID" >/dev/null
if [ -z "${API_URL:-}" ]; then API_URL="$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format='value(status.url)')"; fi
echo "Backend address: $API_URL"

echo "1/3  Building and deploying the dashboard..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud run deploy "$SERVICE" --source frontend --region "$REGION" --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,API_URL=$API_URL" \
  --memory 256Mi --cpu 1 --min-instances 0 --max-instances 3 --concurrency 80 --timeout 30

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo "2/3  Dashboard address: $URL"

echo "3/3  Telling the backend that this address may use it..."
CUR="$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format='value(spec.template.spec.containers[0].env)' 2>/dev/null | grep -o "FRONTEND_ORIGINS[^;}]*" || true)"
ORIGINS="$URL${EXTRA_ORIGINS:+,$EXTRA_ORIGINS}"        # EXTRA_ORIGINS = your custom domain, if you add one
gcloud run services update "$BACKEND_SERVICE" --region "$REGION" --update-env-vars "^@^FRONTEND_ORIGINS=$ORIGINS"
echo
echo "Done.  Open  $URL  and sign in with the admin email and password you used for the backend."
