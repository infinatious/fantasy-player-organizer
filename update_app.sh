#!/usr/bin/env bash
# Pulls, rebuilds, and restarts the deployed app. Safe whether you run this
# as `./update_app.sh` or `sudo ./update_app.sh` — git/npm/build always run
# as APP_USER (never root) so files stay owned correctly; only the service
# restart needs root.
set -euo pipefail

APP_DIR="/opt/fantasy-team-organizer"
APP_USER="kauffpc"
SERVICE_NAME="fantasy-organizer"

run_as_app_user() {
  if [ "$(id -u)" -eq 0 ]; then
    sudo -u "$APP_USER" -H bash -c "$1"
  else
    bash -c "$1"
  fi
}

echo "==> Pulling latest changes"
run_as_app_user "cd '$APP_DIR' && git pull"

echo "==> Installing dependencies"
run_as_app_user "cd '$APP_DIR' && npm ci"

echo "==> Building"
run_as_app_user "cd '$APP_DIR' && npm run build"

echo "==> Restarting service"
sudo systemctl restart "$SERVICE_NAME"

sleep 2
echo "==> Service status"
sudo systemctl status "$SERVICE_NAME" --no-pager --lines=15

echo "==> Verifying"
curl -s -o /dev/null -w "local curl: %{http_code}\n" http://localhost/ || true
