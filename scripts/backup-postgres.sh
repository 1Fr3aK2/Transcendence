#!/bin/sh

BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/appdb_$TIMESTAMP.sql"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    -h postgres \
    -p 5432 \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Backup created: $BACKUP_FILE"

    find "$BACKUP_DIR" \
        -name "appdb_*.sql" \
        -type f \
        -mtime +"$RETENTION_DAYS" \
        -delete
else
    echo "Backup failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi