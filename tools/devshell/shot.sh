#!/bin/sh
# Saves a screenshot of the devshell's desktop to target/devshell/shots/NAME.png.
# Usage: tools/devshell/shot.sh NAME
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
STATE="$ROOT/target/devshell"
[ -f "$STATE/bus" ] || { echo "devshell is not running (tools/devshell/run.sh)" >&2; exit 1; }
[ $# -eq 1 ] || { echo "usage: $0 NAME" >&2; exit 2; }
OUT="$STATE/shots/$1.png"
DBUS_SESSION_BUS_ADDRESS=$(cat "$STATE/bus") gdbus call --session --dest org.gnome.Shell.Screenshot \
    --object-path /org/gnome/Shell/Screenshot \
    --method org.gnome.Shell.Screenshot.Screenshot false false "$OUT" > /dev/null
echo "$OUT"
