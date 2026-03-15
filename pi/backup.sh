#!/usr/bin/env bash
# ===========================================================================
# Under the Glass — OneDrive Backup Script
# Backs up scores.json to OneDrive via rclone.
# Runs via cron every 6 hours.
# Prerequisite: rclone config with a remote named "onedrive"
# ===========================================================================

SCORES_FILE="/opt/utg-server/data/scores.json"
REMOTE="onedrive:UnderTheGlass/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

if [ ! -f "$SCORES_FILE" ]; then
  echo "No scores file found at $SCORES_FILE"
  exit 0
fi

# Upload current scores with timestamp
rclone copyto "$SCORES_FILE" "${REMOTE}/scores-${TIMESTAMP}.json" --quiet

# Also keep a "latest" copy
rclone copyto "$SCORES_FILE" "${REMOTE}/scores-latest.json" --quiet

# Prune backups older than 30 days
rclone delete "${REMOTE}" --min-age 30d --quiet 2>/dev/null || true

echo "[$(date)] Backup complete: scores-${TIMESTAMP}.json"
