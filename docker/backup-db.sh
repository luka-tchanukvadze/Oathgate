#!/bin/bash
# Dump both Oathgate databases to timestamped, compressed files
# Keeps the last 7 days and deletes what is older
# Read only on the live databases, so it is safe to run while everything is up
set -e

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

  docker exec oathgate-postgres pg_dump -U "$POSTGRES_USER" "$db" | gzip > "$out"

  echo "backup done: $out"
done

find "$DEST" -name "oathgate*_*.sql.gz" -mtime +7 -delete
