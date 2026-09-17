#!/bin/sh
# Container entrypoint (Railway or any single-service host).
#   1. If the volume is empty and a replica exists, RESTORE the corpus first.
#   2. Run the engine under litestream so every WAL frame is replicated off-box.
set -e

DB="${CAPTURE_DB_PATH:-/data/capture.db}"
CONFIG="/app/deploy/litestream.railway.yml"
mkdir -p "$(dirname "$DB")"

if [ -n "$LITESTREAM_BUCKET" ]; then
  if [ ! -f "$DB" ]; then
    echo "no corpus on the volume — restoring from the replica if one exists"
    litestream restore -config "$CONFIG" -if-replica-exists "$DB"
  fi
  exec litestream replicate -config "$CONFIG" -exec "npx tsx scripts/serve.ts"
fi

echo "WARNING: LITESTREAM_BUCKET is unset — the corpus has NO off-box backup." >&2
exec npx tsx scripts/serve.ts
