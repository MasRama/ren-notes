# Renotes

A notes app for Linux with the calm, familiar feel of Notes on the Mac.
Three panes, folders, checklists, tables, pictures and tags, saved as you type
and reopened exactly where you left off. Everything stays on your computer:
no account, no cloud, no telemetry.

> **Status:** in development, heading for 0.1. Built and tested on GNOME 46
> (Wayland) first.

## Build from source

Renotes is a [Tauri 2](https://tauri.app) app: a Rust core and a Vue page.

```sh
cargo test -p renotes-core
```

The app itself, packaging and a `.deb` arrive with the first release.

## How it is built

[ARCHITECTURE.md](ARCHITECTURE.md) describes the parts and the rules they
follow. Read it before changing the code.

## Licence

GPL-3.0-or-later. Renotes is not affiliated with Apple.
