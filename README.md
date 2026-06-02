# USB Autoplay Plugin

Volumio plugin for automatic playback of USB media.

This plugin reproduces the USB autoplay behavior previously implemented through a shell script, systemd service and udev rule.

## First version behavior

- Waits for MPD to be available
- Updates the MPD library
- Checks for playable content under the configured USB path
- Optionally stops current playback
- Clears the current queue
- Adds USB content to the queue
- Sets random/repeat/single/consume modes
- Starts playback

Author: Manuel Finotto
