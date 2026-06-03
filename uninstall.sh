#!/bin/bash

set -e

echo "Uninstalling USB Autoplay plugin"

rm -f /etc/udev/rules.d/99-volumio-usb-autoplay.rules
rm -f /etc/systemd/system/volumio-usb-autoplay.service
rm -f /usr/local/bin/volumio-usb-autoplay.sh

systemctl daemon-reload || true
udevadm control --reload || true

echo "USB Autoplay plugin uninstall completed"
echo "pluginuninstallend"
exit 0
