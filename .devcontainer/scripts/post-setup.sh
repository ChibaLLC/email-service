#!/usr/bin/env bash

NODE_AUTH_TOKEN="$(gh auth token 2>/dev/null || true)"
if [ -n "$NODE_AUTH_TOKEN" ]; then
  export NODE_AUTH_TOKEN
  # Add to ~/.bashrc if not already present
  if ! grep -q 'export NODE_AUTH_TOKEN=' "$HOME/.bashrc" 2>/dev/null; then
    echo "export NODE_AUTH_TOKEN=\"\$(gh auth token 2>/dev/null || true)\"" >> "$HOME/.bashrc"
  fi
  echo "✔ NODE_AUTH_TOKEN exported for npm private registry access."
else
  echo "⚠️  Could not retrieve NODE_AUTH_TOKEN from gh. Private npm packages may not work."
fi

# Install dependencies if not already done
if [ ! -d "/workspaces/email-service/node_modules" ]; then
  echo "📦 Installing dependencies..."
  cd /workspaces/email-service && pnpm install --frozen-lockfile 2>/dev/null || pnpm install
fi

# Push database schema
echo "🗄️  Pushing database schema..."
cd /workspaces/email-service && pnpm db:push 2>/dev/null || echo "⚠️ db:push failed — database may not be ready yet. Run 'pnpm db:push' manually."

echo "✅ Post-setup complete. Run 'pnpm dev' to start the dev server."