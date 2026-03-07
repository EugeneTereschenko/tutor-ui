#!/usr/bin/env bash
set -euo pipefail

REPO="EugeneTereschenko/tutor-ui"

# ---- Choose your GCP project (either set PROJECT_ID or set gcloud default project) ----
PROJECT_ID="${PROJECT_ID:-}"
if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
fi
[[ -n "$PROJECT_ID" ]] || { echo "ERROR: PROJECT_ID is empty. Run: gcloud config set project YOUR_PROJECT_ID"; exit 1; }

# ---- Service account email (create or reuse) ----
SA_NAME="${SA_NAME:-github-actions-firebase}"
SA_EMAIL="${SA_EMAIL:-$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com}"

# ---- Where to write the JSON key locally (keep it safe; delete after setting secrets) ----
KEY_FILE="${KEY_FILE:-./firebase-sa-key.json}"

command -v gcloud >/dev/null || { echo "ERROR: gcloud not found."; exit 1; }
command -v gh >/dev/null || { echo "ERROR: gh not found."; exit 1; }

# Login if needed
gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q . || gcloud auth login
gh auth status >/dev/null 2>&1 || gh auth login

# Ensure service account exists (create if missing)
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating service account: $SA_EMAIL"
  gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT_ID" \
    --display-name "GitHub Actions Firebase deploy"
else
  echo "Service account already exists: $SA_EMAIL"
fi

# NOTE: Roles needed depend on what you deploy.
# Common for Firebase Hosting deploys:
# - roles/firebasehosting.admin
# - roles/iam.serviceAccountUser (sometimes needed)
# Add more roles if you deploy Functions/Firestore/etc.
echo "Granting roles to $SA_EMAIL (you may adjust as needed)..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/firebasehosting.admin" >/dev/null

# Create a new JSON key file (this creates a *new* key each run)
echo "Creating key file at $KEY_FILE"
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL" \
  --project "$PROJECT_ID"

# Set GitHub repo secrets
echo "Setting GitHub secrets on $REPO"
gh secret set FIREBASE_PROJECT_ID -R "$REPO" -b"$PROJECT_ID"
gh secret set FIREBASE_SERVICE_ACCOUNT -R "$REPO" < "$KEY_FILE"

echo "Done."
echo "IMPORTANT: $KEY_FILE is a sensitive private key. Consider deleting it now:"
echo "  rm -f \"$KEY_FILE\""