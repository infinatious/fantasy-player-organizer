#!/usr/bin/env bash
# One-time bootstrap for a blank Ubuntu VPS: installs Node, clones the repo,
# builds it, sets up Caddy as a reverse proxy on 80/443, and wires up a
# systemd service plus a nightly auto-update cron job. After this, use
# update_app.sh for routine pulls/rebuilds/restarts (it also re-applies the
# Caddy config, so editing the DOMAIN here is the only place you need to).
#
# Run as root (or via sudo): sudo ./install_vps.sh [repo-url] [domain]
#
# The Next.js app itself only binds to 127.0.0.1 — Caddy is the sole public
# entry point on 80/443. No firewall rules are touched here; that's managed
# elsewhere for these boxes.
#
# DOMAIN is optional. With it, Caddy gets you automatic HTTPS (Let's
# Encrypt) for free. Without it, Caddy still fronts the app on plain :80
# (no TLS) so the box is usable before DNS is pointed anywhere.
#
# This app has no login/auth. Instead, each install gets its own random
# private path (a UUID) baked into the build via Next's `basePath`, so the
# app only answers at https://DOMAIN/<uuid>/... — hitting the bare domain
# 404s. That's what lets several tenants share one domain/tunnel, each
# routed (in Cloudflare Tunnel, or wherever) to their own box/uuid. The
# generated uuid is persisted so re-runs and update_app.sh reuse the same
# one instead of silently breaking existing links/tunnel routes.
set -euo pipefail

APP_DIR="/opt/fantasy-team-organizer"
APP_USER="kauffpc"
SERVICE_NAME="fantasy-organizer"
REPO_URL="${1:-https://github.com/infinatious/fantasy-player-organizer}"
DOMAIN="${2:-}"
NODE_MAJOR="22"
PORT="3000"
DOMAIN_STATE_FILE="/etc/fantasy-organizer-domain"
PATH_STATE_FILE="/etc/fantasy-organizer-path"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root (sudo ./install_vps.sh)." >&2
  exit 1
fi

run_as_app_user() {
  sudo -u "$APP_USER" -H bash -c "$1"
}

echo "==> Installing OS packages (git, build tools for native modules, curl)"
apt-get update
apt-get install -y git build-essential python3 curl ca-certificates

echo "==> Installing Node.js ${NODE_MAJOR}.x (skipping if already present)"
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" != "$NODE_MAJOR" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
else
  echo "    node $(node --version) already installed, skipping"
fi

echo "==> Installing Caddy (skipping if already present)"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
else
  echo "    caddy already installed, skipping"
fi

echo "==> Ensuring app user '$APP_USER' exists"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$APP_USER"
  echo "    created user '$APP_USER' — set up SSH keys / sudo access for it separately"
else
  echo "    user '$APP_USER' already exists, skipping"
fi

echo "==> Fetching the app"
if [ -d "$APP_DIR/.git" ]; then
  echo "    $APP_DIR already exists, pulling latest instead of cloning"
  run_as_app_user "cd '$APP_DIR' && git pull"
else
  # /opt isn't writable by a regular user, so root creates and hands over an
  # empty target dir first; the actual clone runs as APP_USER so an SSH
  # deploy key set up for that user (not root) is what gets used.
  mkdir -p "$APP_DIR"
  chown "$APP_USER:$APP_USER" "$APP_DIR"
  if ! run_as_app_user "git clone '$REPO_URL' '$APP_DIR'"; then
    echo
    echo "Clone failed. If this is a private repo, HTTPS won't work without" >&2
    echo "credentials — set up an SSH deploy key for '$APP_USER' (not root)" >&2
    echo "and re-run with the SSH remote, e.g.:" >&2
    echo "  sudo ./install_vps.sh git@github.com:infinatious/fantasy-player-organizer.git" >&2
    exit 1
  fi
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> Assigning private path"
if [ -s "$PATH_STATE_FILE" ]; then
  TENANT_PATH="$(cat "$PATH_STATE_FILE")"
  echo "    reusing existing path from $PATH_STATE_FILE: $TENANT_PATH"
else
  TENANT_PATH="/$(cat /proc/sys/kernel/random/uuid)"
  echo "$TENANT_PATH" > "$PATH_STATE_FILE"
  echo "    generated new path: $TENANT_PATH"
fi

echo "==> Installing dependencies"
run_as_app_user "cd '$APP_DIR' && npm ci"

echo "==> Building"
run_as_app_user "cd '$APP_DIR' && NEXT_PUBLIC_BASE_PATH='$TENANT_PATH' npm run build"

echo "==> Writing systemd unit"
NPM_BIN="$(command -v npm)"
NODE_BIN_DIR="$(dirname "$(command -v node)")"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Fantasy Player Organizer
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PATH=${NODE_BIN_DIR}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${NPM_BIN} run start -- -H 127.0.0.1 -p ${PORT}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "==> Writing Caddyfile"
if [ -n "$DOMAIN" ]; then
  echo "$DOMAIN" > "$DOMAIN_STATE_FILE"
  cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
	redir / ${TENANT_PATH}/ 302
	reverse_proxy 127.0.0.1:${PORT}
}
EOF
else
  rm -f "$DOMAIN_STATE_FILE"
  echo "    no domain given — Caddy will serve plain HTTP on :80, no TLS"
  cat > /etc/caddy/Caddyfile <<EOF
:80 {
	redir / ${TENANT_PATH}/ 302
	reverse_proxy 127.0.0.1:${PORT}
}
EOF
fi

echo "==> Setting up nightly auto-update (cron, 3:17 AM)"
cat > /etc/cron.d/fantasy-organizer-update <<EOF
17 3 * * * root ${APP_DIR}/update_app.sh >> /var/log/fantasy-organizer-update.log 2>&1
EOF
chmod 644 /etc/cron.d/fantasy-organizer-update

echo "==> Saving access URL for easy reference"
if [ -n "$DOMAIN" ]; then
  ACCESS_URL="https://${DOMAIN}${TENANT_PATH}/"
else
  ACCESS_URL="http://$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')${TENANT_PATH}/"
fi
echo "$ACCESS_URL" > "/home/$APP_USER/fantasy-organizer-url.txt"
chown "$APP_USER:$APP_USER" "/home/$APP_USER/fantasy-organizer-url.txt"
cat > /etc/update-motd.d/99-fantasy-organizer <<EOF
#!/bin/sh
echo
echo "Fantasy Player Organizer: ${ACCESS_URL}"
echo "(also saved at ~${APP_USER}/fantasy-organizer-url.txt)"
EOF
chmod 755 /etc/update-motd.d/99-fantasy-organizer

echo "==> Enabling and starting services"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
# `restart` (not `enable --now`) so a re-run picks up a changed unit file
# even if the service is already active — e.g. an older install that had
# the app itself bound to :80 before Caddy existed would otherwise keep
# squatting on that port and Caddy would fail to bind it.
systemctl restart "$SERVICE_NAME"
systemctl enable caddy
systemctl restart caddy

sleep 2
echo "==> Service status"
systemctl status "$SERVICE_NAME" --no-pager --lines=15

echo "==> Verifying"
echo "    (bare '/' 404s/redirects by design — the app only answers under its private path)"
curl -s -o /dev/null -w "app (127.0.0.1:${PORT}${TENANT_PATH}/): %{http_code}\n" "http://127.0.0.1:${PORT}${TENANT_PATH}/" || true
curl -s -o /dev/null -w "caddy (localhost:80${TENANT_PATH}/):    %{http_code}\n" "http://localhost:80${TENANT_PATH}/" || true

echo
echo "=================================================================="
echo " Your private URL (bookmark this — it's the only way in):"
echo "   ${ACCESS_URL}"
echo " Also saved to /home/${APP_USER}/fantasy-organizer-url.txt and shown"
echo " on login (MOTD). Persisted at ${PATH_STATE_FILE} for update_app.sh."
echo "=================================================================="
echo
if [ -n "$DOMAIN" ]; then
  echo "Done. Caddy is serving https://${DOMAIN} (auto-HTTPS via Let's Encrypt)"
  echo "and proxying to the app on 127.0.0.1:${PORT}."
else
  echo "Done. Caddy is serving plain HTTP on :80, proxying to the app on"
  echo "127.0.0.1:${PORT}. Re-run with a domain as the 2nd argument once DNS"
  echo "is pointed here to get automatic HTTPS."
fi
echo "Nightly auto-update via cron is set up (see /etc/cron.d/fantasy-organizer-update)."
echo "For manual deploys, run update_app.sh."
