#!/bin/sh
# Daily backup: database dump and uploaded files, encrypted, with rotation.
# Run from the application folder by a cPanel cron job (see docs/ops.md):
#   sh scripts/backup.sh
# Needs DATABASE_URL and BACKUP_PASSPHRASE (in .env or the environment).
# Optional BACKUP_REMOTE: an rclone destination (for example r2:portfolio-backups)
# to copy each archive outside the hosting.
set -eu

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL manquant}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE manquant}"
DATA_DIR="${DATA_DIR:-$HOME/portfolio_data}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
STAMP=$(date +%Y-%m-%d_%H%M)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
umask 077
mkdir -p "$BACKUP_DIR"

pg_dump --no-owner --no-privileges "$DATABASE_URL" > "$WORK/database.sql"
tar -czf "$WORK/files.tar.gz" -C "$DATA_DIR" --exclude=backups --exclude=mail-outbox uploads private 2>/dev/null || tar -czf "$WORK/files.tar.gz" -C "$DATA_DIR" --exclude=backups uploads
tar -czf "$WORK/backup.tar.gz" -C "$WORK" database.sql files.tar.gz

ARCHIVE="$BACKUP_DIR/portfolio-$STAMP.tar.gz.enc"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$WORK/backup.tar.gz" -out "$ARCHIVE" -pass env:BACKUP_PASSPHRASE
echo "Sauvegarde chiffrée : $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

if [ -n "${BACKUP_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$ARCHIVE" "$BACKUP_REMOTE" && echo "Copie hors hébergement : $BACKUP_REMOTE"
fi

find "$BACKUP_DIR" -name 'portfolio-*.tar.gz.enc' -mtime +"$KEEP_DAYS" -delete
