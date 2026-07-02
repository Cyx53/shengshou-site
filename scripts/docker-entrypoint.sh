#!/bin/sh
set -e

mkdir -p /data/db /app/public/uploads/books /backups

npx prisma db push

if [ "$RUN_SEED" = "true" ]; then
  npm run db:seed
fi

exec "$@"
