#!/bin/bash
# Push score data from Pi to Azure Static Web App API
# Run via cron every 5 minutes:
#   */5 * * * * /opt/utg-server/pi/push-to-azure.sh >> /var/log/utg-push.log 2>&1

AZURE_URL="${UTG_AZURE_URL:-https://your-site.azurestaticapps.net}"
PUSH_KEY="${UTG_PUSH_KEY:-}"
LOCAL_API="http://localhost:3000/api/scores"

if [ -z "$PUSH_KEY" ]; then
  echo "$(date -Iseconds) ERROR: UTG_PUSH_KEY not set"
  exit 1
fi

# Fetch current scores from local server
SCORES=$(curl -sf "$LOCAL_API")
if [ $? -ne 0 ] || [ -z "$SCORES" ]; then
  echo "$(date -Iseconds) ERROR: Failed to fetch local scores"
  exit 1
fi

# Validate JSON before sending
if ! echo "$SCORES" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  echo "$(date -Iseconds) ERROR: Local scores response is not valid JSON"
  exit 1
fi

# Push to Azure
RESPONSE=$(curl -sf -X POST \
  "${AZURE_URL}/api/push-scores" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${PUSH_KEY}" \
  -d "$SCORES")

if [ $? -eq 0 ]; then
  echo "$(date -Iseconds) OK: $RESPONSE"
else
  echo "$(date -Iseconds) ERROR: Failed to push to Azure"
  exit 1
fi
