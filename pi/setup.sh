#!/usr/bin/env bash
# ===========================================================================
# Under the Glass — Raspberry Pi 5 Setup Script
# Run this on a fresh Raspberry Pi OS Lite (64-bit) install.
# Usage: curl -sSL https://raw.githubusercontent.com/acatalano212/UnderTheGlassHighScoreServer/master/pi/setup.sh | bash
#   — or — clone the repo first and run: bash pi/setup.sh
# ===========================================================================

set -euo pipefail

APP_DIR="/opt/utg-server"
APP_USER="utg"
REPO_URL="https://github.com/acatalano212/UnderTheGlassHighScoreServer.git"
NODE_MAJOR=22

echo "============================================="
echo "  Under the Glass — Pi Setup"
echo "============================================="
echo ""

# ---------------------------------------------------------------------------
# 1. System updates
# ---------------------------------------------------------------------------
echo ">>> Updating system packages..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

# ---------------------------------------------------------------------------
# 2. Install Node.js 22 LTS
# ---------------------------------------------------------------------------
echo ">>> Installing Node.js ${NODE_MAJOR}..."
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  ARCH=$(uname -m)
  if [ "$ARCH" = "armv7l" ] || [ "$(dpkg --print-architecture)" = "armhf" ]; then
    NODE_ARCH="armv7l"
  elif [ "$ARCH" = "aarch64" ]; then
    NODE_ARCH="arm64"
  else
    NODE_ARCH="x64"
  fi
  NODE_VER="v${NODE_MAJOR}.16.0"
  echo "    Downloading Node.js ${NODE_VER} for ${NODE_ARCH}..."
  curl -fsSL "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-linux-${NODE_ARCH}.tar.xz" | sudo tar -xJ -C /usr/local --strip-components=1
fi
echo "    Node $(node -v), npm $(npm -v)"

# ---------------------------------------------------------------------------
# 3. Install system dependencies for kiosk mode
# ---------------------------------------------------------------------------
echo ">>> Installing kiosk dependencies..."
sudo apt-get install -y -qq \
  chromium-browser \
  xserver-xorg \
  x11-xserver-utils \
  xinit \
  openbox \
  unclutter \
  git \
  network-manager \
  wireless-tools

# Ensure NetworkManager manages WiFi
sudo systemctl enable NetworkManager 2>/dev/null || true
sudo systemctl start NetworkManager 2>/dev/null || true

# ---------------------------------------------------------------------------
# 4. Create app user and clone repo
# ---------------------------------------------------------------------------
echo ">>> Setting up application..."
if ! id "$APP_USER" &>/dev/null; then
  sudo useradd -r -m -s /bin/bash "$APP_USER"
  # Allow utg user to run nmcli for WiFi management
  echo "$APP_USER ALL=(ALL) NOPASSWD: /usr/bin/nmcli" | sudo tee /etc/sudoers.d/utg-wifi >/dev/null
fi

if [ -d "$APP_DIR" ]; then
  echo "    Updating existing installation..."
  cd "$APP_DIR"
  sudo -u "$APP_USER" git pull --ff-only
else
  echo "    Cloning fresh..."
  sudo git clone "$REPO_URL" "$APP_DIR"
  sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

cd "$APP_DIR"
sudo -u "$APP_USER" npm install --production --quiet

# Create data directory
sudo -u "$APP_USER" mkdir -p "$APP_DIR/data"

# Copy .env if not present
if [ ! -f "$APP_DIR/.env" ]; then
  sudo -u "$APP_USER" cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo "    ⚠️  Edit $APP_DIR/.env to set your STERN_EVENT_CODE and UTG_API_KEY"
fi

# ---------------------------------------------------------------------------
# 5. Install systemd service
# ---------------------------------------------------------------------------
echo ">>> Installing systemd service..."
sudo cp "$APP_DIR/pi/utg-server.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable utg-server
sudo systemctl restart utg-server

echo "    Waiting for server to start..."
sleep 3
if systemctl is-active --quiet utg-server; then
  echo "    ✅ Server is running!"
else
  echo "    ❌ Server failed to start. Check: sudo journalctl -u utg-server -n 50"
fi

# ---------------------------------------------------------------------------
# 6. Configure kiosk mode (Chromium auto-start)
# ---------------------------------------------------------------------------
echo ">>> Configuring kiosk mode..."
sudo cp "$APP_DIR/pi/kiosk.service" /etc/systemd/system/
sudo cp "$APP_DIR/pi/kiosk.sh" /usr/local/bin/utg-kiosk.sh
sudo chmod +x /usr/local/bin/utg-kiosk.sh
sudo systemctl daemon-reload
sudo systemctl enable kiosk

# Auto-login on tty1
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
cat <<'AUTOLOGIN' | sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf >/dev/null
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin utg --noclear %I $TERM
AUTOLOGIN

# ---------------------------------------------------------------------------
# 7. Install Tailscale for remote access
# ---------------------------------------------------------------------------
echo ">>> Installing Tailscale..."
if ! command -v tailscale &>/dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
sudo systemctl enable tailscaled
sudo systemctl start tailscaled

# Check if already authenticated
if ! tailscale status &>/dev/null; then
  echo ""
  echo "    ⚠️  Tailscale needs authentication. Run:"
  echo "    sudo tailscale up --ssh"
  echo "    Then visit the URL shown to log in."
  echo ""
fi

# ---------------------------------------------------------------------------
# 8. Configure rclone for OneDrive backup (optional)
# ---------------------------------------------------------------------------
echo ">>> Installing rclone for OneDrive backup..."
if ! command -v rclone &>/dev/null; then
  curl -fsSL https://rclone.org/install.sh | sudo bash
fi

# Install backup cron job
sudo cp "$APP_DIR/pi/backup.sh" /usr/local/bin/utg-backup.sh
sudo chmod +x /usr/local/bin/utg-backup.sh

# Add cron job (every 6 hours)
(sudo -u "$APP_USER" crontab -l 2>/dev/null | grep -v utg-backup; echo "0 */6 * * * /usr/local/bin/utg-backup.sh >> /var/log/utg-backup.log 2>&1") | sudo -u "$APP_USER" crontab -

# ---------------------------------------------------------------------------
# 9. Performance tweaks
# ---------------------------------------------------------------------------
echo ">>> Applying Pi optimizations..."

# Reduce GPU memory (headless-ish, Chromium uses CPU rendering)
if ! grep -q "gpu_mem=" /boot/firmware/config.txt 2>/dev/null; then
  echo "gpu_mem=128" | sudo tee -a /boot/firmware/config.txt >/dev/null
fi

# Disable unused services
sudo systemctl disable bluetooth 2>/dev/null || true
sudo systemctl stop bluetooth 2>/dev/null || true

# ---------------------------------------------------------------------------
# Done!
# ---------------------------------------------------------------------------
echo ""
echo "============================================="
echo "  ✅ Setup Complete!"
echo "============================================="
echo ""
echo "  Dashboard:  http://$(hostname -I | awk '{print $1}'):3000"
echo "  Admin:      http://$(hostname -I | awk '{print $1}'):3000/admin.html"
echo ""
echo "  Next steps:"
echo "  1. Edit /opt/utg-server/.env (set STERN_EVENT_CODE, UTG_API_KEY)"
echo "  2. Run: sudo tailscale up --ssh  (for remote access)"
echo "  3. Run: rclone config  (to set up OneDrive backup)"
echo "  4. Reboot to start kiosk mode: sudo reboot"
echo ""
