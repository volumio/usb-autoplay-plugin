#!/bin/bash
set -e

LOGFILE="/var/log/volumio-usb-autoplay.log"
CONFIG_FILE="/data/configuration/system_controller/usb_autoplay_plugin/usb-autoplay-runtime.conf"

# Service runs as the backend user (volumio); install.sh pre-creates the log
# owned by volumio. Ensure it exists but never abort if the path isn't writable.
mkdir -p "$(dirname "$LOGFILE")" 2>/dev/null || true
touch "$LOGFILE" 2>/dev/null || true
chmod 664 "$LOGFILE" 2>/dev/null || true


ENABLED=1
USB_URI="music-library/USB"
RANDOM_PLAY=1
REPEAT_PLAY=1
KILL_PULSEAUDIO=1
MAX_WAIT_API=60
MAX_WAIT_USB=120

if [ -f "$CONFIG_FILE" ]; then
    . "$CONFIG_FILE"
fi


log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOGFILE" 2>/dev/null || true
}

api_get() { curl -sS --max-time 10 "$1"; }
api_post_json() { curl -sS --max-time 20 -X POST "$1" -H "Content-Type: application/json" -d "$2"; }

if [ "$ENABLED" != "1" ]; then
    log "USB autoplay disabled, exiting"
    exit 0
fi

log "=== Starting USB autoplay sequence through Volumio REST API ==="

log "Waiting for Volumio API..."
elapsed=0
until api_get "http://localhost:3000/api/v1/getState" > /dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$MAX_WAIT_API" ]; then
        log "ERROR: timeout waiting for Volumio API"
        exit 1
    fi
done
log "Volumio API ready"

log "Waiting for USB browse URI: $USB_URI"
elapsed=0
until api_get "http://localhost:3000/api/v1/browse?uri=$USB_URI" 2>/dev/null | grep -q '"navigation"\|"items"\|"title"\|"uri"'; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$MAX_WAIT_USB" ]; then
        log "ERROR: timeout waiting for USB browse URI: $USB_URI"
        exit 1
    fi
done
log "USB browse URI available"

if [ "$KILL_PULSEAUDIO" = "1" ]; then
    log "Killing PulseAudio if running"
    pulseaudio -k > /dev/null 2>&1 || true
    sleep 1
fi

log "Clearing Volumio queue"
api_get "http://localhost:3000/api/v1/commands/?cmd=clearQueue" > /dev/null 2>&1 || true

if [ "$RANDOM_PLAY" = "1" ]; then
    log "Enabling random through Volumio"
    api_get "http://localhost:3000/api/v1/commands/?cmd=random&value=true" > /dev/null 2>&1 || true
else
    log "Disabling random through Volumio"
    api_get "http://localhost:3000/api/v1/commands/?cmd=random&value=false" > /dev/null 2>&1 || true
fi

if [ "$REPEAT_PLAY" = "1" ]; then
    log "Enabling repeat through Volumio"
    api_get "http://localhost:3000/api/v1/commands/?cmd=repeat&value=true" > /dev/null 2>&1 || true
else
    log "Disabling repeat through Volumio"
    api_get "http://localhost:3000/api/v1/commands/?cmd=repeat&value=false" > /dev/null 2>&1 || true
fi

log "Calling replaceAndPlay for USB URI: $USB_URI"
PAYLOAD="{\"item\":{\"uri\":\"$USB_URI\",\"service\":\"mpd\",\"type\":\"folder\"}}"
api_post_json "http://localhost:3000/api/v1/replaceAndPlay" "$PAYLOAD" >> "$LOGFILE" 2>&1 || {
    log "ERROR: replaceAndPlay failed"
    exit 1
}


log "Starting playback through Volumio"
sleep 2
api_get "http://localhost:3000/api/v1/commands/?cmd=play" > /dev/null 2>&1 || true
sleep 2
api_get "http://localhost:3000/api/v1/commands/?cmd=play" > /dev/null 2>&1 || true


log "USB autoplay command sent successfully"
exit 0