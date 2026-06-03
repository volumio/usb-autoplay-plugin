# USB Autoplay Plugin

Volumio OEM plugin for automatic playback of USB media.

## Current status

- Plugin installation works
- USB insertion detection via udev works
- systemd one-shot autoplay service works
- MPD playlist generation from USB works
- Automatic playback works
- Random and repeat playback work

## Known issue

Playback starts correctly, but the Volumio UI is not fully synchronized with the MPD playlist created by the autoplay script.

As a result, metadata, cover art and next/previous commands in the Volumio UI may still refer to the previous Volumio queue.

## Architecture

USB insertion is detected by udev. udev starts a systemd one-shot service, which runs the autoplay shell script.

Author: Manuel Finotto
