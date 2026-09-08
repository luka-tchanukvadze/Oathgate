#!/bin/bash
# Dump both Oathgate databases to timestamped, compressed files
# Keeps the last 7 days and deletes what is older
# Read only on the live databases, so it is safe to run while everything is up
#
# pipefail matters more than it looks. Without it, pg_dump failing while gzip
# happily compresses its empty output is a success: the script prints "backup
# done", carries on, and deletes the older backups that were the real ones
set -euo pipefail

# The .env beside the compose file, so the user and database name are not
# repeated in two places that can drift apart
cd "$(dirname "$0")/.."
set -a
. ./.env
set +a

STAMP=$(date +%Y%m%d_%H%M%S)
DEST=~/backups

mkdir -p "$DEST"

# Notifications keeps its own database, and a ledger backup without the record
# of what the merchant was told is only half the story
for db in "$POSTGRES_DB" oathgate_notifications; do
  out="$DEST/${db}_$STAMP.sql.gz"

  # Written under a different name and moved only once the dump has finished,
  # so a file with the real name is always a complete one
  docker exec oathgate-postgres pg_dump -U "$POSTGRES_USER" "$db" |
    gzip > "$out.partial"
  mv "$out.partial" "$out"

  echo "backup done: $out"
done

# Only reached when every dump above succeeded, because set -e stops the script
# on the first failure. Pruning after a failed run is how a week of good
# backups disappears behind one bad night
find "$DEST" -name "oathgate*_*.sql.gz" -mtime +7 -delete
find "$DEST" -name "*.sql.gz.partial" -mtime +1 -delete
