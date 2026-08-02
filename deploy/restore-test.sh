#!/usr/bin/env bash
# RESTORE TEST — rehearse recovery. A backup that has never been restored is a
# hope, not a backup. Restores a snapshot into a throwaway location and verifies
# integrity + that the amended DoD thresholds hold (>=3 article sources, >=4
# factor streams). Run it after the first backup, and periodically thereafter.
#
#   deploy/restore-test.sh /var/lib/lensai/backups/capture-<ts>.db
#   deploy/restore-test.sh s3://bucket/lensai/capture   # via litestream
set -euo pipefail

SRC="${1:?usage: restore-test.sh <snapshot.db | litestream-replica-url>}"
cd "$(dirname "$0")/.."
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
RESTORED="$WORK/restored.db"

if [[ "$SRC" == *"://"* ]]; then
  echo "== restoring from litestream replica: $SRC =="
  litestream restore -o "$RESTORED" "$SRC"
else
  echo "== restoring from snapshot file: $SRC =="
  cp "$SRC" "$RESTORED"
fi

echo "== verifying restored corpus =="
/usr/bin/node --import tsx scripts/restore-check.ts "$RESTORED"
echo "== RESTORE TEST OK =="
