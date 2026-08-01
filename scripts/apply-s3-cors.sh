#!/bin/bash
# =============================================================================
# Apply CORS policy to an S3 bucket (KnowledgeVault)
#
# Requires:
#   - AWS CLI installed and configured (aws configure / env vars)
#   - The target bucket to EXIST (see docs/S3_CORS_SETUP.md section 1)
#
# Usage:
#   ./scripts/apply-s3-cors.sh
#   BUCKET=my-bucket ./scripts/apply-s3-cors.sh
# =============================================================================
set -euo pipefail

BUCKET="${BUCKET:-knowledgevault-dev}"
# Region must match the bucket's actual region AND the backend's S3_REGION env var.
# Override with: REGION=eu-central-1 ./scripts/apply-s3-cors.sh
REGION="${REGION:-us-east-1}"
POLICY_FILE="infrastructure/s3-cors-policy.json"

if [ ! -f "$POLICY_FILE" ]; then
  echo "❌ Policy file not found: $POLICY_FILE (run from the repo root)" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "❌ AWS CLI is not installed. Install it: https://aws.amazon.com/cli/" >&2
  exit 1
fi

echo "🔍 Checking that bucket '$BUCKET' exists..."
if ! aws s3api head-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null 2>&1; then
  echo "❌ Bucket '$BUCKET' does not exist (or no access)." >&2
  echo "   Create it first: AWS Console → S3 → Create bucket → '$BUCKET' (us-east-1)." >&2
  echo "   See docs/S3_CORS_SETUP.md section 1." >&2
  exit 1
fi
echo "✅ Bucket '$BUCKET' exists."

echo "🔄 Applying CORS policy from $POLICY_FILE ..."
aws s3api put-bucket-cors \
  --bucket "$BUCKET" \
  --cors-configuration "file://$POLICY_FILE"

echo "✅ CORS policy applied."

echo "🔍 Verifying..."
aws s3api get-bucket-cors --bucket "$BUCKET"

echo ""
echo "✅ Done! Wait 1–2 minutes for propagation, then test a document upload."
echo "   Preflight check:"
echo "   curl -s -i -X OPTIONS https://$BUCKET.s3.us-east-1.amazonaws.com/ \\"
echo "     -H 'Origin: https://vorota-znaniy-frontend-one.vercel.app' \\"
echo "     -H 'Access-Control-Request-Method: PUT' \\"
echo "     -H 'Access-Control-Request-Headers: Content-Type'"
