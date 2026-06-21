#!/bin/bash
set -e

echo "========================================"
echo "  NmaMonitor - Status Page Installer"
echo "========================================"
echo ""

cd "$(dirname "$0")"
INSTALL_DIR=$(pwd)

# Check for root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./install.sh)"
  exit 1
fi

# Install Node.js if needed
if ! command -v node &>/dev/null; then
  echo "[1/5] Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "[1/5] Node.js already installed: $(node -v)"
fi

# Install npm dependencies
echo "[2/5] Installing npm dependencies..."
npm install --omit=optional

# Create systemd service
echo "[3/5] Creating systemd service..."
cat > /etc/systemd/system/nma-monitor.service << EOF
[Unit]
Description=NmaMonitor Status Page
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(which node) server.js
Restart=always
RestartSec=5
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nma-monitor

# Start service
echo "[4/5] Starting NmaMonitor..."
systemctl restart nma-monitor
sleep 2

# Install Playwright if available
if npm list playwright &>/dev/null; then
  echo "  Installing Playwright browsers..."
  npx playwright install chromium 2>/dev/null || echo "  Playwright browsers skipped (not critical)"
fi

# Verify
echo "[5/5] Verifying installation..."
if systemctl is-active --quiet nma-monitor; then
  echo ""
  echo "========================================"
  echo "  NmaMonitor is running!"
  echo "  Access the status page at:"
  echo "  http://$(hostname -I | awk '{print $1}'):3000"
  echo "  Admin page: http://$(hostname -I | awk '{print $1}'):3000/admin.html"
  echo "========================================"
else
  echo "ERROR: Service failed to start. Check 'journalctl -u nma-monitor -n 50'"
  exit 1
fi
