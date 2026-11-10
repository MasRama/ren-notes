#!/bin/sh
# Runs Renotes in an isolated, headless GNOME Shell: a private session bus,
# temporary XDG directories and GSettings in a keyfile, so nothing touches
# your own session, settings or notes. The page runs on demo data. Stays in
# the foreground; Ctrl-C stops it. Then use shot.sh and stop.sh.
#
# Usage: tools/devshell/run.sh [--dark] [--backdrop=light|dark]
#   --dark           the GNOME dark style (the app follows it)
#   --backdrop=...   a plain light (default) or dark desktop behind the window
#
# Needs: target/debug/renotes (cargo build -p renotes-app) and app/node_modules.
set -eu

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
HERE="$ROOT/tools/devshell"
STATE="$ROOT/target/devshell"

if [ -z "${RENOTES_DEVSHELL_INNER:-}" ]; then
    SCHEME=default
    GTK_THEME_NAME=Adwaita
    BACKDROP='#d9dde3'
    for arg in "$@"; do
        case "$arg" in
            --dark) SCHEME=prefer-dark GTK_THEME_NAME=Adwaita-dark ;;
            --backdrop=light) BACKDROP='#d9dde3' ;;
            --backdrop=dark) BACKDROP='#2b2f36' ;;
            *) echo "unknown option: $arg" >&2; exit 2 ;;
        esac
    done
    APP="$ROOT/target/debug/renotes"
    [ -x "$APP" ] || { echo "missing $APP: run 'cargo build -p renotes-app'" >&2; exit 1; }

    rm -rf "$STATE"
    mkdir -p "$STATE/config/glib-2.0/settings" "$STATE/data/gnome-shell/extensions" \
        "$STATE/cache" "$STATE/runtime" "$STATE/services" "$STATE/shots"
    chmod 700 "$STATE/runtime"
    cp -r "$HERE/devtools@renotes" "$STATE/data/gnome-shell/extensions/"

    cat > "$STATE/config/glib-2.0/settings/keyfile" <<KEYFILE
[org/gnome/shell]
enabled-extensions=['devtools@renotes']
disable-user-extensions=false
welcome-dialog-last-shown-version='999'

[org/gnome/desktop/interface]
color-scheme='$SCHEME'
# No settings portal on this bus, so GTK (and the page) read the theme name.
gtk-theme='$GTK_THEME_NAME'

[org/gnome/desktop/background]
picture-uri=''
picture-uri-dark=''
picture-options='none'
color-shading-type='solid'
primary-color='$BACKDROP'
KEYFILE

    # A bare session bus: no system services, so the shell does not start
    # gvfs, portals or evolution in here.
    cat > "$STATE/bus.conf" <<BUSCONF
<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-Bus Bus Configuration 1.0//EN"
 "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <type>session</type>
  <keep_umask/>
  <listen>unix:dir=$STATE/runtime</listen>
  <auth>EXTERNAL</auth>
  <servicedir>$STATE/services</servicedir>
  <policy context="default">
    <allow send_destination="*" eavesdrop="true"/>
    <allow eavesdrop="true"/>
    <allow own="*"/>
  </policy>
</busconfig>
BUSCONF

    exec env -u DISPLAY -u WAYLAND_DISPLAY -u GNOME_SETUP_DISPLAY \
        RENOTES_DEVSHELL_INNER=1 APP="$APP" \
        XDG_CONFIG_HOME="$STATE/config" XDG_DATA_HOME="$STATE/data" \
        XDG_CACHE_HOME="$STATE/cache" XDG_RUNTIME_DIR="$STATE/runtime" \
        GSETTINGS_BACKEND=keyfile \
        dbus-run-session --config-file="$STATE/bus.conf" -- "$0"
fi

# Inside the private bus from here on.
PIDS=""
cleanup() {
    if [ -n "$PIDS" ]; then
        # shellcheck disable=SC2086
        kill $PIDS 2>/dev/null || true
    fi
    rm -f "$STATE/bus" "$STATE/run.pid"
}
trap cleanup EXIT
trap 'exit 0' INT TERM
echo "$$" > "$STATE/run.pid"

wait_name() {
    i=0
    until gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus \
        --method org.freedesktop.DBus.NameHasOwner "$1" 2>/dev/null | grep -q true; do
        i=$((i + 1))
        [ "$i" -le 150 ] || { echo "timed out waiting for $1" >&2; exit 1; }
        sleep 0.2
    done
}

# The shell's system bus is this bus too: it never talks to the real logind.
DBUS_SYSTEM_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" gnome-shell --headless --wayland --no-x11 \
    --virtual-monitor 1920x1080 --wayland-display renotes-devshell > "$STATE/shell.log" 2>&1 &
SHELL_PID=$!
PIDS="$PIDS $SHELL_PID"
wait_name org.gnome.Shell.Screenshot

# The page, on demo data, then the window that loads it.
(cd "$ROOT/app" && VITE_DEMO=1 exec node node_modules/.bin/vite --port 1430 --strictPort) \
    > "$STATE/vite.log" 2>&1 &
PIDS="$PIDS $!"
until python3 -c "import socket; socket.create_connection(('127.0.0.1', 1430), 1)" 2>/dev/null; do
    sleep 0.2
done
WAYLAND_DISPLAY=renotes-devshell GDK_BACKEND=wayland "$APP" > "$STATE/app.log" 2>&1 &
PIDS="$PIDS $!"

echo "$DBUS_SESSION_BUS_ADDRESS" > "$STATE/bus"
echo "devshell ready (state in $STATE)"
wait "$SHELL_PID"
