#!/usr/bin/env bash
# Deploy the student PORTAL to Google Cloud Run. Run in Google Cloud Shell from the repository root:
#
#   export PROJECT_ID="your-gcp-project-id"
#   export MONGODB_URI='mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority'
#   export ADMIN_EMAIL="you@yourschool.org"
#   export ADMIN_PASSWORD='a long password'
#   # when ready for real payments (otherwise the portal says "payments not switched on"):
#   export RAZORPAY_KEY_ID=rzp_live_xxx RAZORPAY_KEY_SECRET=xxx RAZORPAY_WEBHOOK_SECRET=xxx
#   # for password-reset emails:  export SMTP_URL='smtps://user:pass@host:465' MAIL_FROM='Botclub Labs <no-reply@yourdomain>'
#   bash deploy/deploy-portal.sh
set -euo pipefail
: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-asia-south1}"
SERVICE="${PORTAL_SERVICE:-botclub-portal}"
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com

put_secret() { if gcloud secrets describe "$1" >/dev/null 2>&1; then printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null; else printf '%s' "$2" | gcloud secrets create "$1" --replication-policy=automatic --data-file=- >/dev/null; fi; }
has_secret() { gcloud secrets describe "$1" >/dev/null 2>&1; }

[ -n "${MONGODB_URI:-}" ] && put_secret portal-mongodb-uri "$MONGODB_URI"
has_secret portal-mongodb-uri || { echo "MONGODB_URI is required the first time."; exit 1; }
has_secret portal-jwt-secret || put_secret portal-jwt-secret "$(openssl rand -hex 32)"
[ -n "${ADMIN_PASSWORD:-}" ] && put_secret portal-admin-password "$ADMIN_PASSWORD"
[ -n "${RAZORPAY_KEY_SECRET:-}" ] && put_secret portal-razorpay-secret "$RAZORPAY_KEY_SECRET"
[ -n "${RAZORPAY_WEBHOOK_SECRET:-}" ] && put_secret portal-razorpay-webhook "$RAZORPAY_WEBHOOK_SECRET"
[ -n "${SMTP_URL:-}" ] && put_secret portal-smtp-url "$SMTP_URL"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUN_SA="${RUN_SA:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"
SECRETS="MONGODB_URI=portal-mongodb-uri:latest,JWT_SECRET=portal-jwt-secret:latest"
ENVV="NODE_ENV=production,MONGODB_DB=${MONGODB_DB:-botclub_portal}"
for s in portal-mongodb-uri portal-jwt-secret portal-admin-password portal-razorpay-secret portal-razorpay-webhook portal-smtp-url; do
  has_secret "$s" && gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:$RUN_SA" --role=roles/secretmanager.secretAccessor >/dev/null
done
if has_secret portal-admin-password && [ -n "${ADMIN_EMAIL:-}" ]; then SECRETS="$SECRETS,ADMIN_PASSWORD=portal-admin-password:latest"; ENVV="$ENVV,ADMIN_EMAIL=$ADMIN_EMAIL"; fi
if has_secret portal-razorpay-secret && [ -n "${RAZORPAY_KEY_ID:-}" ]; then SECRETS="$SECRETS,RAZORPAY_KEY_SECRET=portal-razorpay-secret:latest"; ENVV="$ENVV,PAYMENT_MODE=razorpay,RAZORPAY_KEY_ID=$RAZORPAY_KEY_ID"; fi
has_secret portal-razorpay-webhook && SECRETS="$SECRETS,RAZORPAY_WEBHOOK_SECRET=portal-razorpay-webhook:latest"
has_secret portal-smtp-url && SECRETS="$SECRETS,SMTP_URL=portal-smtp-url:latest"
[ -n "${MAIL_FROM:-}" ] && ENVV="$ENVV,MAIL_FROM=$MAIL_FROM"
[ -n "${BASE_URL:-}" ] && ENVV="$ENVV,BASE_URL=$BASE_URL"
[ -n "${SUPPORT_EMAIL:-}" ] && ENVV="$ENVV,SUPPORT_EMAIL=$SUPPORT_EMAIL"

gcloud run deploy "$SERVICE" --source portal --region "$REGION" --allow-unauthenticated \
  --set-env-vars "$ENVV" --set-secrets "$SECRETS" \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 --concurrency 80 --timeout 60
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo; echo "Portal is live: $URL"
echo "If BASE_URL was not set, run again with BASE_URL=$URL (password-reset links and payment checks use it)."
echo "Razorpay webhook URL to enter in the Razorpay dashboard:  $URL/api/billing/webhook   (event: payment.captured)"
