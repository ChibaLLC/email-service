#!/usr/bin/env sh

set -eu

PORTS="25 110 143 465 587 993 995 4190"
COMMON_SERVICES="postfix exim4 dovecot courier-imap courier-pop"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Free the standard Stalwart mail ports on a Linux host.

Usage:
  sudo ./scripts/stalwart/free-ports.sh

What it does:
  1. Stops common host mail services if they exist.
  2. Stops Docker containers publishing the Stalwart mail ports.
  3. Kills any remaining listeners on those ports.

Ports:
  25 110 143 465 587 993 995 4190
EOF
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root or with sudo."
  exit 1
fi

echo "Checking current listeners on: $PORTS"
ss -ltnp | grep -E ':(25|110|143|465|587|993|995|4190)\s' || true

if command -v systemctl >/dev/null 2>&1; then
  for service in $COMMON_SERVICES; do
    if systemctl list-unit-files "$service.service" >/dev/null 2>&1; then
      if systemctl is-active --quiet "$service"; then
        echo "Stopping service: $service"
        systemctl stop "$service"
      fi

      if systemctl is-enabled --quiet "$service" >/dev/null 2>&1; then
        echo "Disabling service: $service"
        systemctl disable "$service" >/dev/null 2>&1 || true
      fi
    fi
  done
fi

if command -v docker >/dev/null 2>&1; then
  container_ids="$(docker ps --format '{{.ID}} {{.Ports}}' | grep -E '(:25->|:110->|:143->|:465->|:587->|:993->|:995->|:4190->)' | awk '{print $1}' || true)"

  if [ -n "$container_ids" ]; then
    echo "Stopping Docker containers using Stalwart mail ports"
    echo "$container_ids" | xargs docker stop
  fi
fi

if command -v fuser >/dev/null 2>&1; then
  echo "Killing remaining listeners on Stalwart mail ports"
  fuser -k 25/tcp 110/tcp 143/tcp 465/tcp 587/tcp 993/tcp 995/tcp 4190/tcp >/dev/null 2>&1 || true
else
  echo "fuser is not installed; skipping process termination step."
fi

echo "Remaining listeners after cleanup:"
ss -ltnp | grep -E ':(25|110|143|465|587|993|995|4190)\s' || true

echo "Done. You can retry: docker compose -f ./docker-compose.prod.yml --env-file .env up -d"