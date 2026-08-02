#!/usr/bin/env bash
# Cron fallback backup (use when NOT running litestream): take a WAL-consistent
# snapshot, then ship it off-machine. A snapshot that stays on the same disk is
# not a backup. Schedule from cron, e.g.:  0 * * * * /opt/lensai/deploy/backup.sh
set -euo pipefail

cd "$(dirname "$0")/.."                     # repo root (/opt/lensai)
: "${CAPTURE_BACKUP_DIR:=/var/lib/lensai/backups}"
export CAPTURE_BACKUP_DIR

# Consistent snapshot via better-sqlite3 .backup (equivalent to `sqlite3 .backup`,
# WAL-safe). Writes capture-<timestamp>.db into CAPTURE_BACKUP_DIR.
/usr/bin/node --import tsx scripts/backup.ts

latest="$(ls -1t "$CAPTURE_BACKUP_DIR"/capture-*.db | head -1)"
echo "snapshot: $latest"

# Ship off-machine (choose one; matches deploy/capture.env).
if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp "$latest" "$BACKUP_S3_URI/"
elif [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  rclone copy "$latest" "$BACKUP_RCLONE_REMOTE"
else
  echo "WARN: no off-machine target (BACKUP_S3_URI or BACKUP_RCLONE_REMOTE) — snapshot is LOCAL ONLY, not a real backup" >&2
fi

# Retain the 14 most recent local snapshots.
ls -1t "$CAPTURE_BACKUP_DIR"/capture-*.db | tail -n +15 | xargs -r rm -f
