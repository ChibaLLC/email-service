#!/bin/sh
set -e

echo "🗄️  Running database migrations..."
if ! npx drizzle-kit migrate; then
  echo "⚠️  Migration failed — database may not be ready. Retrying in 3s..."
  sleep 3
  if ! npx drizzle-kit migrate; then
    echo "❌ Migration failed after retry. Starting server anyway." >&2
  fi
fi

echo "🚀 Starting server..."
exec "$@"
