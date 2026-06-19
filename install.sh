#!/bin/bash
set -e
# Resolve the plugin's installed folder. In OEM builds all plugin install.sh
# scripts are concatenated into one file, so $0 points to the consolidated
# script, not this plugin. Detect the actual install location like other plugins.
NAME="usb_autoplay_plugin"
if [ -d "/data/plugins/system_controller/${NAME}" ]; then
  PLUGIN_DIR="/data/plugins/system_controller/${NAME}"
elif [ -d "/myvolumio/plugins/system_controller/${NAME}" ]; then
  PLUGIN_DIR="/myvolumio/plugins/system_controller/${NAME}"
else
  PLUGIN_DIR="/volumio/app/plugins/system_controller/${NAME}"
fi
echo "Installing USB Autoplay plugin"
if ! command -v curl >/dev/null 2>&1; then
  echo "curl not found, installing curl"
  apt-get update
  apt-get install -y curl
else
  echo "curl already installed"
fi
cp "$PLUGIN_DIR/scripts/volumio-usb-autoplay.sh" /usr/local/bin/volumio-usb-autoplay.sh
chmod 755 /usr/local/bin/volumio-usb-autoplay.sh
cp "$PLUGIN_DIR/systemd/volumio-usb-autoplay.service" /etc/systemd/system/volumio-usb-autoplay.service
chmod 644 /etc/systemd/system/volumio-usb-autoplay.service
cp "$PLUGIN_DIR/udev/99-volumio-usb-autoplay.rules" /etc/udev/rules.d/99-volumio-usb-autoplay.rules
chmod 644 /etc/udev/rules.d/99-volumio-usb-autoplay.rules
cat > "$PLUGIN_DIR/usb-autoplay-runtime.conf" <<EOF2
ENABLED=1
USB_URI="music-library/USB"
RANDOM_PLAY=1
REPEAT_PLAY=1
KILL_PULSEAUDIO=1
MAX_WAIT_API=60
MAX_WAIT_USB=120
EOF2
chmod 664 "$PLUGIN_DIR/usb-autoplay-runtime.conf" || true
touch /var/log/volumio-usb-autoplay.log
chown volumiooem:volumio /var/log/volumio-usb-autoplay.log || true
chmod 664 /var/log/volumio-usb-autoplay.log || true
systemctl daemon-reload
udevadm control --reload
echo "USB Autoplay plugin install completed"
echo "plugininstallend"
exit 0
