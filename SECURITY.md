# Security policy

## Supported versions

Only the latest release gets security fixes.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it
privately through
[GitHub's private vulnerability reporting](https://github.com/MasRama/ren-notes/security/advisories/new).

Include what you found, how to reproduce it and which version you used. You
will get an answer within 7 days. Once a fix is released, the advisory is
published with credit to you unless you prefer otherwise.

## What Renotes touches

Useful context when you look for problems:

- Renotes runs as your user. Its only network requests fetch a link pasted
  on a line of its own, for the link's card (title, site and picture). A
  link in a note opens in your browser only when you click it.
- It keeps its library in `~/.local/share/ren-notes/` (or under
  `$XDG_DATA_HOME`) on Linux and in `%APPDATA%\Renotes\` on Windows: one
  SQLite file, attachments named by their SHA-256, and thumbnails.
- On Linux, on first start it reads, never writes, the prototype's library
  at `~/.local/share/renotes/notes.db` if one exists.
- The page reaches files only through the `renotes` protocol
  (`renotes://localhost` on Linux, `http://renotes.localhost` on Windows), which
  serves attachments and thumbnails by a 64-character hex id and nothing
  else.
