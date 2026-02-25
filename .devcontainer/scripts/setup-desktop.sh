#!/bin/bash
set -e

export DISPLAY="${DISPLAY:-:1}"
sudo apt-get install -y novnc
sudo apt-get install -y xvfb x11-utils x11vnc websockify
# ── 1. Xvfb ───────────────────────────────────────────────────────────────────
if ! xdpyinfo -display "$DISPLAY" &>/dev/null; then
  echo ">>> Starting Xvfb on $DISPLAY..."

  # Clear stale lock files
  rm -f "/tmp/.X${DISPLAY#:}-lock" "/tmp/.X11-unix/X${DISPLAY#:}"

  Xvfb "$DISPLAY" \
    -screen 0 1920x1080x24 \
    -ac \
    +render \
    -noreset &

  echo ">>> Waiting for Xvfb..."
  for i in $(seq 1 20); do
    xdpyinfo -display "$DISPLAY" &>/dev/null && echo ">>> Xvfb ready." && break
    sleep 0.5
  done

  if ! xdpyinfo -display "$DISPLAY" &>/dev/null; then
    echo "ERROR: Xvfb failed to start."
    exit 1
  fi
else
  echo ">>> X server already running on $DISPLAY"
fi

# ── 2. D-Bus (required for notifications) ────────────────────────────────────
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
  echo ">>> Starting D-Bus session..."
  eval "$(dbus-launch --sh-syntax)"
  export DBUS_SESSION_BUS_ADDRESS
  # Write to file so your app can source it: source /tmp/dbus-session-env
  echo "export DBUS_SESSION_BUS_ADDRESS='$DBUS_SESSION_BUS_ADDRESS'" > /tmp/dbus-session-env
fi

export NO_AT_BRIDGE=1

# ── 3. XFCE desktop ───────────────────────────────────────────────────────────
if ! pgrep -x xfce4-session > /dev/null; then
  echo ">>> Starting XFCE..."
  DISPLAY="$DISPLAY" dbus-launch xfce4-session &
  sleep 3
fi

# ── 4. Dunst notification daemon ──────────────────────────────────────────────
if ! pgrep -x dunst > /dev/null; then
  echo ">>> Starting dunst..."
  DISPLAY="$DISPLAY" dunst &
  sleep 0.5
fi

# ── 5. x11vnc ─────────────────────────────────────────────────────────────────
if ! pgrep -x x11vnc > /dev/null; then
  echo ">>> Starting x11vnc..."
  x11vnc \
    -display "$DISPLAY" \
    -nopw \
    -listen localhost \
    -xkb \
    -forever \
    -rfbport 5901 &
  sleep 1
fi

# ── 6. websockify + noVNC ─────────────────────────────────────────────────────
if ! pgrep -f websockify > /dev/null; then
  echo ">>> Starting websockify..."
  NOVNC_DIR=$(find /usr/share/novnc /usr/local/share/novnc /opt/novnc -name "vnc.html" 2>/dev/null | head -1 | xargs dirname)

  if [ -z "$NOVNC_DIR" ]; then
    echo "ERROR: noVNC web files not found. Run setup-desktop.sh first."
    exit 1
  fi

  websockify --web="$NOVNC_DIR" 6080 localhost:5901 &
  sleep 1
fi

# ── 7. Done ───────────────────────────────────────────────────────────────────
echo ""
echo "✅  Desktop ready"
echo "    DISPLAY  = $DISPLAY"
echo "    D-Bus    = $DBUS_SESSION_BUS_ADDRESS"
echo "    URL      = http://localhost:6080/vnc.html"
echo ""
echo "    To launch your Tauri app:"
echo "    source /tmp/dbus-session-env && DISPLAY=$DISPLAY cargo tauri dev"
echo ""

# Smoke test notification
sleep 2 && DISPLAY="$DISPLAY" notify-send "Desktop Ready" "Dev environment is up!" &