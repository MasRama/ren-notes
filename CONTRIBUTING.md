# Contributing to Renotes

Thanks for helping. This file covers how to set up, what a good change looks
like and how releases work.

## Before you start

- For a bug, open an issue with the steps to reproduce it, unless the fix is
  small and obvious.
- For a new feature, open an issue first and describe what you want to do.
  Renotes follows how Notes on the Mac behaves; say how the Mac does it when
  you can.
- Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing the code.

## Setup

You need:

- Rust (`rustup` picks the toolchain from `rust-toolchain.toml`)
- Node.js 22.13 or newer
- The WebKitGTK and GTK development packages Tauri needs. On Ubuntu 24.04:

  ```sh
  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev
  ```

```sh
cargo test --workspace
cd app
npm ci
npm run check
npm test
npm run tauri dev
```

`npm run dev` alone serves the page in a browser on demo data, which is the
quickest way to work on the interface. `?theme=dark`, `?view=gallery`,
`?sidebar=0` and `?empty=1` pick a starting state.

To try the app without touching your own notes, point it at another data
folder: `XDG_DATA_HOME=/tmp/renotes-try npm run tauri dev`.

To see the window frame (shadow, corners, tiling) without it landing on your
desktop, run the app in a headless GNOME Shell of its own. It uses demo data
and a private session bus, so it touches neither your notes nor your session:

```sh
cargo build -p renotes-app
tools/devshell/run.sh           # --dark for the dark style
tools/devshell/shot.sh frame    # in another terminal: target/devshell/shots/frame.png
tools/devshell/stop.sh
```

## Making a change

- Write a test that fails without your change, then make it pass.
- Run what CI runs before you push:

  ```sh
  cargo fmt --all --check
  cargo clippy --workspace --all-targets --locked -- -D warnings
  cargo test --workspace --locked
  (cd app && npm run check && npm test && npm run build)
  ```

- For a change to how something looks or moves, add a screenshot in light
  and dark to the pull request.

## Commit messages

Renotes uses [Conventional Commits](https://www.conventionalcommits.org/).
The changelog and version numbers are generated from them, so write the
message for someone reading the changelog:

```
feat(editor): turn "- " at the start of a line into a list
fix(list): keep the selection when a note moves to the top
```

Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`,
`chore`. Scopes: `core`, `app`, `editor`, `list`, `sidebar`, `search`,
`smart-folders`, `ui`, `packaging`, `deps`. A breaking change gets a `!`
after the scope and a `BREAKING CHANGE:` footer.

## Releases

Releases are automated with
[release-please](https://github.com/googleapis/release-please). It keeps a
release pull request open that collects the changes on `main`. When a
maintainer merges it, it tags the version, writes `CHANGELOG.md`, and CI
builds the `.deb` and attaches it to the GitHub release. Version numbers
follow [SemVer](https://semver.org/).

## Code of conduct

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
