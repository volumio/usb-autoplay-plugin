#!/bin/bash
# In OEM builds all plugin install.sh scripts are concatenated into one file and
# run together, so $0 points to the consolidated script, not this plugin. For the
# same reason this script must stay concatenation-safe: NO `set -e` (it would
# abort every plugin listed after this one) and NO terminal `exit 0` (it would
# stop the consolidated script before later plugins, e.g. onboarding, install).
# Detect the actual install location like other plugins.
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
# Runtime config is written by index.js (onStart, as the volumio backend) to
# /data/configuration/system_controller/usb_autoplay_plugin/usb-autoplay-runtime.conf
# — a path volumio owns and can rewrite, present in both user-install and baked
# builds. Don't seed it here: creating it at build time would leave a root-owned
# dir the backend can't write to. The script falls back to defaults if absent.
touch /var/log/volumio-usb-autoplay.log
chown volumio:volumio /var/log/volumio-usb-autoplay.log || true
chmod 664 /var/log/volumio-usb-autoplay.log || true
systemctl daemon-reload || true
udevadm control --reload || true
echo "USB Autoplay plugin install completed"
echo "plugininstallend"
