#!/bin/sh
set -e

echo "🗄️  Running database migrations..."
if ! npx drizzle-kit migrate; then
  echo "⚠️  Migration failed — database may not be ready. Retrying in 3s..."
  sleep 3
  npx drizzle-kit migrate
fi

echo "🚀 Starting server..."
exec "$@"
