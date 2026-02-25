#!/usr/bin/env bash
set -e

echo "🔎 Checking GitHub CLI authentication..."
if gh auth status >/dev/null 2>&1; then
  echo "✔ GitHub CLI already authenticated"
else
  echo "🔐 Not authenticated — starting gh auth login"
  gh auth login --web --git-protocol ssh
fi

echo "📡 Fetching GitHub user info..."
GH_LOGIN="$(gh api user -q .login)"
GIT_NAME="$(gh api user -q '.name // .login')"
GIT_EMAIL="$(gh api user -q '.email // empty')"

if [ -z "$GIT_EMAIL" ]; then
  echo "⚠️  GitHub email not public — using noreply address"
  GIT_EMAIL="${GH_LOGIN}@users.noreply.github.com"
fi

echo "🛠️  Configuring git identity..."
git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"

echo "🔐 Configuring git to use GitHub CLI credentials..."
gh auth setup-git

# Configure SSH for better compatibility
echo "🔑 Configuring SSH for Git repositories..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add GitHub to known_hosts if not already there
if ! grep -q "github.com" ~/.ssh/known_hosts 2>/dev/null; then
  ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null || true
  ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts 2>/dev/null || true
fi

echo "✅ Git setup complete"
git config --list | grep '^user\.'

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
