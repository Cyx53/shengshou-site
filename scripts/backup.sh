#!/bin/sh
set -e

STAMP="$(date +%F-%H%M%S)"
DEST="/backups/shengshou-${STAMP}.tar.gz"

tar -czf "$DEST" -C /data db -C /app/public uploads
echo "Backup written to $DEST"
