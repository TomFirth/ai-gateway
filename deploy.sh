#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="192.168.1.81"
REMOTE_DIR="/home/barber/ai-gateway"
REMOTE_USER="barber"
REMOTE="${REMOTE_USER:+${REMOTE_USER}@}${REMOTE_HOST}"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Commit and push your changes before deploying." >&2
  git status --short
  exit 1
fi

if [ ! -f .env ]; then
  echo "Missing .env file in the repository root. Create one before deploying." >&2
  exit 1
fi

CURRENT_BRANCH=$(git symbolic-ref --short HEAD)

echo "Pushing branch $CURRENT_BRANCH to origin..."
git push origin "$CURRENT_BRANCH"

echo "Copying .env to $REMOTE:$REMOTE_DIR/.env..."
scp .env "$REMOTE:$REMOTE_DIR/.env"

echo "Deploying on $REMOTE..."
ssh "$REMOTE" "cd '$REMOTE_DIR' && git pull --ff-only origin '$CURRENT_BRANCH' && npm install"

echo "Deployment complete."
