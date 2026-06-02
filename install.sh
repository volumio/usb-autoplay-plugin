#!/bin/bash

echo "Installing USB Autoplay plugin dependencies"

# mpc is normally available on Volumio, but we try to install it if missing.
if ! command -v mpc >/dev/null 2>&1; then
  echo "mpc not found, installing mpc"
  apt-get update
  apt-get install -y mpc
else
  echo "mpc already installed"
fi

echo "USB Autoplay plugin install completed"
exit 0
