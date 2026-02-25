#!/bin/sh
set -e

echo "🗄️  Running database migrations..."
npx drizzle-kit migrate 2>&1 || {
  echo "⚠️  Migration failed — database may not be ready. Retrying in 3s..."
  sleep 3
  npx drizzle-kit migrate 2>&1 || echo "❌ Migration failed after retry. Starting server anyway."
}

echo "🚀 Starting server..."
exec "$@"
