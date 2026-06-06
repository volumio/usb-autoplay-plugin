# USB Autoplay Plugin

Volumio OEM plugin for automatic playback of USB media.

## Current status

- Plugin installation works
- USB insertion detection via udev works
- systemd one-shot autoplay service works
- USB autoplay works through Volumio REST API
- Volumio queue, metadata, cover art and Next/Previous stay synchronized
- Random and repeat playback are set through Volumio commands

## Architecture

USB insertion is detected by udev. udev starts a systemd one-shot service, which runs the autoplay shell script.

The script does not manipulate MPD's playlist directly. Instead, it uses Volumio's REST API on localhost:3000, so Volumio remains the source of truth for the queue and metadata.

Author: Manuel Finotto
