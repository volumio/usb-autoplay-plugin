#!/bin/bash

set -e

LOGFILE="/var/log/volumio-usb-autoplay.log"
CONFIG_FILE="/data/plugins/system_hardware/usb-autoplay-plugin/usb-autoplay-runtime.conf"

ENABLED=1
USB_PATH="USB"
RANDOM_PLAY=1
REPEAT_PLAY=1
KILL_PULSEAUDIO=1
MAX_WAIT_MPD=60
MAX_WAIT_USB=120

if [ -f "$CONFIG_FILE" ]; then
    . "$CONFIG_FILE"
fi

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOGFILE"
}

if [ "$ENABLED" != "1" ]; then
    log "USB autoplay disabled, exiting"
    exit 0
fi

log "=== Starting USB autoplay sequence ==="

log "Waiting for MPD..."
elapsed=0
until mpc status > /dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$MAX_WAIT_MPD" ]; then
        log "ERROR: timeout waiting for MPD"
        exit 1
    fi
done
log "MPD ready"

log "Updating MPD library..."
mpc update > /dev/null 2>&1 || true

log "Waiting for USB content at MPD path: $USB_PATH"
elapsed=0
until mpc listall "$USB_PATH" 2>/dev/null | grep -q .; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$MAX_WAIT_USB" ]; then
        log "ERROR: timeout waiting for USB content at $USB_PATH"
        exit 1
    fi
done
log "USB content available"

if [ "$KILL_PULSEAUDIO" = "1" ]; then
    log "Killing PulseAudio if running"
    pulseaudio -k > /dev/null 2>&1 || true
    sleep 1
fi

log "Stopping current playback"
mpc stop > /dev/null 2>&1 || true

log "Clearing current playlist"
mpc clear > /dev/null 2>&1 || true

log "Adding USB content from $USB_PATH"
mpc add "$USB_PATH" > /dev/null 2>&1

if [ "$RANDOM_PLAY" = "1" ]; then
    log "Enabling random"
    mpc random on > /dev/null 2>&1 || true
else
    log "Disabling random"
    mpc random off > /dev/null 2>&1 || true
fi

if [ "$REPEAT_PLAY" = "1" ]; then
    log "Enabling repeat"
    mpc repeat on > /dev/null 2>&1 || true
else
    log "Disabling repeat"
    mpc repeat off > /dev/null 2>&1 || true
fi

log "Disabling single and consume"
mpc single off > /dev/null 2>&1 || true
mpc consume off > /dev/null 2>&1 || true

log "Starting USB playback"
mpc play > /dev/null 2>&1

log "USB autoplay completed successfully"
exit 0
