# Changelog

## 0.1.0 (2026-11-10)


### Features

* **app:** library store, keyboard map and short times ([439d2da](https://github.com/MasRama/ren-notes/commit/439d2da083a2da2a212ec41d7203d2332592f98f))
* **app:** page scaffold with a typed IPC client, in-memory API, date groups and tags ([d20e632](https://github.com/MasRama/ren-notes/commit/d20e632fec890bb8c1f181681d5c2bac2a94ee7c))
* **app:** Tauri window with core commands and the renotes:// protocol ([e2c5e8f](https://github.com/MasRama/ren-notes/commit/e2c5e8f41c5d5f4e63e0ac78d3d066722d3a7748))
* **app:** window shell and sidebar ([46c11ba](https://github.com/MasRama/ren-notes/commit/46c11ba7ed25391d50f11faf3e5e682e26a8f11d))
* **core:** attachments stored by content hash, with picture thumbnails ([a75afdf](https://github.com/MasRama/ren-notes/commit/a75afdf89988a1f1022e7188d3cab7372e5f8bb1))
* **core:** folders with nesting, ordering and delete to trash ([2e236c6](https://github.com/MasRama/ren-notes/commit/2e236c63c84adbe76b8635852c24f5417826eed1))
* **core:** full-text search with word prefixes and title ranking ([2a06aaf](https://github.com/MasRama/ren-notes/commit/2a06aafcaaa446992d685816d399b3d63b8ce8c6))
* **core:** import the first Renotes prototype's library, read-only ([24a77cb](https://github.com/MasRama/ren-notes/commit/24a77cb96e001b03c57dfa4a57657b62beb4e056))
* **core:** list tags in use with their note counts ([0989253](https://github.com/MasRama/ren-notes/commit/0989253ec1d2c3c9711fc440c38425797625c615))
* **core:** notes with autosave fields, tags, pinning and trash ([11f4ae3](https://github.com/MasRama/ren-notes/commit/11f4ae3ed9c4b780d25007082117052c677e9cb4))
* **core:** parse #tags from note text ([98329a7](https://github.com/MasRama/ren-notes/commit/98329a75a377ffa11cd7dea0c582ee04166ef98b))
* **core:** Recently Deleted with recover, purge and a 30-day limit ([7a5dfb6](https://github.com/MasRama/ren-notes/commit/7a5dfb659208dbbc0e59af2c1387cf5c0aa9cecd))
* **core:** save a note without changing its edit time ([97f3fc1](https://github.com/MasRama/ren-notes/commit/97f3fc1cefb2b4f0e44eb112bbd01cfb3a694fa0))
* **core:** session values and the Library entry point ([d9407df](https://github.com/MasRama/ren-notes/commit/d9407dfa05589e746397b74bdba5a7f4f0b0822a))
* **core:** smart folders as saved rules over all notes ([17ee7c1](https://github.com/MasRama/ren-notes/commit/17ee7c177b5cd64cb3b73098f898171056d90e8f))
* **core:** SQLite library with schema migrations, clock and ids ([b7f7312](https://github.com/MasRama/ren-notes/commit/b7f731267c2697a288db6e8a1b8055639068d0c8))
* **editor:** editor pane with format menu, search and find in note ([7240527](https://github.com/MasRama/ren-notes/commit/7240527c6ccf8d406fb40a583f0b872189438936))
* **editor:** note schema, Mac shortcuts, checklists and highlights ([abca47f](https://github.com/MasRama/ren-notes/commit/abca47fccc93ce322e4eaeaeb3b5b535ae1be9ac))
* **editor:** sink checked items and autosave with retry ([0bbf4c0](https://github.com/MasRama/ren-notes/commit/0bbf4c07969b62f59ad3139a48ef19fde3a4df12))
* **list:** note list and gallery ([5398a90](https://github.com/MasRama/ren-notes/commit/5398a9035a4fa75e7337ff897479b4e2cc720239))
* **smart-folders:** dialog to create and edit smart folders ([42060d6](https://github.com/MasRama/ren-notes/commit/42060d619e712957b014bb323e3014497429f035))
* **ui:** theme, icons, context menus and alert dialogs ([f4ab2ce](https://github.com/MasRama/ren-notes/commit/f4ab2cee4b4fe42fac6bb8ea0c9ae3806c80fceb))


### Bug Fixes

* **deps:** update rusqlite to 0.41 for the bundled SQLite fix ([5b831d5](https://github.com/MasRama/ren-notes/commit/5b831d5e58fb9a7384e1769769abd84a3e5ef324))
* **ui:** hide scrollbars until the pointer is over a pane ([6c36b3c](https://github.com/MasRama/ren-notes/commit/6c36b3cf5e4aa0f90816dcace8b0cdd0d06048c3))
