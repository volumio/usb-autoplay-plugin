#!/bin/bash

set -e

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing USB Autoplay plugin"

if ! command -v mpc >/dev/null 2>&1; then
  echo "mpc not found, installing mpc"
  apt-get update
  apt-get install -y mpc
else
  echo "mpc already installed"
fi

echo "Installing autoplay script"
cp "$PLUGIN_DIR/scripts/volumio-usb-autoplay.sh" /usr/local/bin/volumio-usb-autoplay.sh
chmod 755 /usr/local/bin/volumio-usb-autoplay.sh

echo "Installing systemd service"
cp "$PLUGIN_DIR/systemd/volumio-usb-autoplay.service" /etc/systemd/system/volumio-usb-autoplay.service
chmod 644 /etc/systemd/system/volumio-usb-autoplay.service

echo "Installing udev rule"
cp "$PLUGIN_DIR/udev/99-volumio-usb-autoplay.rules" /etc/udev/rules.d/99-volumio-usb-autoplay.rules
chmod 644 /etc/udev/rules.d/99-volumio-usb-autoplay.rules

echo "Preparing runtime configuration"
cat > "$PLUGIN_DIR/usb-autoplay-runtime.conf" <<EOF
ENABLED=1
USB_PATH="USB"
RANDOM_PLAY=1
REPEAT_PLAY=1
KILL_PULSEAUDIO=1
MAX_WAIT_MPD=60
MAX_WAIT_USB=120
EOF
chmod 664 "$PLUGIN_DIR/usb-autoplay-runtime.conf" || true

touch /var/log/volumio-usb-autoplay.log
chown volumiooem:volumio /var/log/volumio-usb-autoplay.log || true
chmod 664 /var/log/volumio-usb-autoplay.log || true

systemctl daemon-reload
udevadm control --reload

echo "USB Autoplay plugin install completed"
echo "plugininstallend"
exit 0
