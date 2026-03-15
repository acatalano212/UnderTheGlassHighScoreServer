# Under the Glass — High Score Server 🎯

Self-hosted pinball leaderboard kiosk for Raspberry Pi 5.  
Displays high scores from **Stern Insider Connected** API + locally managed games (JJP, Spooky, Chicago Gaming, etc).

## Features

- 🏆 Combined leaderboard from Stern API + local scores
- 📺 Chromium kiosk mode for TV displays
- 🎮 Admin panel for manual score management
- 📶 WiFi configuration from admin panel
- 💾 Scores persist to JSON file
- ☁️ OneDrive backup via rclone
- 🔒 Tailscale for secure remote access
- 🔄 Auto-start on boot via systemd

## Quick Start (Development)

```bash
npm install
cp .env.example .env   # edit with your values
npm start              # http://localhost:3000
```

## Raspberry Pi Deployment

1. Flash **Raspberry Pi OS Lite (64-bit)** with SSH enabled
2. Boot the Pi and connect to your network
3. SSH in and run:

```bash
curl -sSL https://raw.githubusercontent.com/acatalano212/UnderTheGlassHighScoreServer/master/pi/setup.sh | bash
```

4. Follow the post-setup instructions to:
   - Edit `.env` with your Stern event code
   - Authenticate Tailscale (`sudo tailscale up --ssh`)
   - Configure rclone for OneDrive backup (`rclone config`)
   - Reboot to start kiosk mode

## Architecture

```
Pi 5 (utg-kiosk)
├── Node.js Express server (port 3000)
│   ├── GET  /api/scores          — combined leaderboard
│   ├── POST /api/scores          — ESP32 score submissions
│   ├── PUT  /api/scores/:id      — admin score updates
│   ├── GET  /api/wifi/status     — current WiFi info
│   ├── GET  /api/wifi/scan       — available networks
│   ├── POST /api/wifi/connect    — join a network
│   └── GET  /api/system          — Pi system info
├── Chromium kiosk (fullscreen dashboard)
├── systemd services (auto-start)
├── Tailscale (remote SSH + web access)
└── rclone cron (OneDrive backup every 6h)
```

## Updating

From your dev machine (via Tailscale):
```bash
ssh utg@utg-kiosk
cd /opt/utg-server
git pull
sudo systemctl restart utg-server
```

## SD Card Backup

Create a full image backup for fast disaster recovery:
```bash
# On another Linux machine with the SD card inserted:
sudo dd if=/dev/sdX of=utg-kiosk-backup.img bs=4M status=progress
# Compress it:
gzip utg-kiosk-backup.img
```

Or use **Raspberry Pi Imager** on Windows/Mac to clone the card.
