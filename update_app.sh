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
PATH_STATE_FILE="/etc/fantasy-organizer-path"

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
# Reuse the private path assigned by install_vps.sh (if any) so the app
# keeps answering at the same URL — a rebuild without it would drop the
# instance back to serving at the bare domain root.
TENANT_PATH="$([ -s "$PATH_STATE_FILE" ] && cat "$PATH_STATE_FILE" || echo "")"
run_as_app_user "cd '$APP_DIR' && NEXT_PUBLIC_BASE_PATH='$TENANT_PATH' npm run build"

echo "==> Restarting service"
sudo systemctl restart "$SERVICE_NAME"

if command -v caddy >/dev/null 2>&1; then
  echo "==> Re-applying Caddy config"
  # Only redirect bare '/' into the private path when there is one — an
  # install predating this feature has no PATH_STATE_FILE, and `redir / /`
  # would just redirect the root to itself.
  REDIR_LINE=""
  if [ -n "$TENANT_PATH" ]; then
    REDIR_LINE="	redir / ${TENANT_PATH}/ 302"
  fi
  if [ -s "$DOMAIN_STATE_FILE" ]; then
    DOMAIN="$(cat "$DOMAIN_STATE_FILE")"
    sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
${DOMAIN} {
${REDIR_LINE}
	reverse_proxy 127.0.0.1:${PORT}
}
EOF
  else
    sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
:80 {
${REDIR_LINE}
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
curl -s -o /dev/null -w "local curl: %{http_code}\n" "http://localhost${TENANT_PATH}/" || true
