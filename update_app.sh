#!/usr/bin/env bash
# Pulls, rebuilds, and restarts the deployed app. Safe whether you run this
# as `./update_app.sh` or `sudo ./update_app.sh` — git/npm/build always run
# as APP_USER (never root) so files stay owned correctly; only the service
# restart needs root.
set -euo pipefail

APP_DIR="/opt/fantasy-team-organizer"
APP_USER="kauffpc"
SERVICE_NAME="fantasy-organizer"
PORT="3000"
DOMAIN_STATE_FILE="/etc/fantasy-organizer-domain"

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

if command -v caddy >/dev/null 2>&1; then
  echo "==> Re-applying Caddy config"
  if [ -s "$DOMAIN_STATE_FILE" ]; then
    DOMAIN="$(cat "$DOMAIN_STATE_FILE")"
    sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
${DOMAIN} {
	reverse_proxy 127.0.0.1:${PORT}
}
EOF
  else
    sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
:80 {
	reverse_proxy 127.0.0.1:${PORT}
}
EOF
  fi
  sudo systemctl reload caddy
fi

sleep 2
echo "==> Service status"
sudo systemctl status "$SERVICE_NAME" --no-pager --lines=15

echo "==> Verifying"
curl -s -o /dev/null -w "local curl: %{http_code}\n" http://localhost/ || true
