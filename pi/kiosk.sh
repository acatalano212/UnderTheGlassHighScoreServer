#!/usr/bin/env bash
# ===========================================================================
# Under the Glass — Kiosk Mode Launcher
# Starts X server + Chromium in fullscreen pointing at the local dashboard.
# ===========================================================================

# Wait for the UTG server to be ready
echo "Waiting for UTG server..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3000/api/scores > /dev/null 2>&1; then
    echo "Server is ready!"
    break
  fi
  sleep 1
done

# Start X server if not already running
if ! pgrep -x Xorg > /dev/null; then
  xinit /usr/bin/openbox-session -- :0 vt1 -nocursor &
  sleep 2
fi

export DISPLAY=:0

# Hide mouse cursor
unclutter -idle 0.1 -root &

# Disable screen blanking / power saving
xset s off
xset -dpms
xset s noblank

# Launch Chromium in kiosk mode
exec chromium-browser \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --kiosk \
  --incognito \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-component-update \
  --no-first-run \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --window-size=1920,1080 \
  --window-position=0,0 \
  "http://localhost:3000"
