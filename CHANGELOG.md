# Changelog

## [0.3.0](https://github.com/MasRama/ren-notes/compare/v0.2.0...v0.3.0) (2026-11-10)


### Features

* **app:** change the notes password from the lock menu ([520b59e](https://github.com/MasRama/ren-notes/commit/520b59e64f34acb5f592e9d2fe3b392e78f35c99))
* **app:** close locked notes after a while without use ([13e43b1](https://github.com/MasRama/ren-notes/commit/13e43b18852499f8c4218751fcf6a107efb57f2e))
* **app:** command to change the notes password ([e2e8c3e](https://github.com/MasRama/ren-notes/commit/e2e8c3e03c9b0b5ce89297923e538f8fef2aa86c))
* **app:** commands to set the notes password and open, close and lock notes ([ce5a838](https://github.com/MasRama/ren-notes/commit/ce5a838cc1aa49564b1a41c6366831f401c136b2))
* **app:** let the sidebar show the desktop through it ([629fdbb](https://github.com/MasRama/ren-notes/commit/629fdbb57610fd9829f8de6edb9e5e1dfa195edf))
* **app:** lock a note from the toolbar or the list, and open it with the password ([a2fb3cd](https://github.com/MasRama/ren-notes/commit/a2fb3cd674549484812407d76260831053479c48))
* **core:** change the notes password, sealing every locked note again ([667f107](https://github.com/MasRama/ren-notes/commit/667f10764eb7a2f0a7f927bdfff57bd6bcd4a82d))
* **core:** lock notes with a password, sealing their content ([b17a86a](https://github.com/MasRama/ren-notes/commit/b17a86a4aac193bceff778b1d8104a352cbd7160))
* **editor:** draw in a note with pen, marker and eraser ([9fb1ed8](https://github.com/MasRama/ren-notes/commit/9fb1ed87ba6a7d4aa7d8bbac45a4bcca7441d96d))
* **editor:** link to another note by typing &gt;&gt; ([55c581e](https://github.com/MasRama/ren-notes/commit/55c581ed49934976506e57d4a4edebca5e7a11ec))
* **editor:** work out sums ending in = as Math Notes does ([4430cdf](https://github.com/MasRama/ren-notes/commit/4430cdfe1c6b501a5edfdc2a9d0b0c6a9109635f))


### Bug Fixes

* **app:** let Tab move between a dialog's fields ([b9a06c1](https://github.com/MasRama/ren-notes/commit/b9a06c16cb96ac596621e27b157f9ee702b23261))

## [0.2.0](https://github.com/MasRama/ren-notes/compare/v0.1.0...v0.2.0) (2026-11-10)


### Features

* **app:** frost menus, popovers and dialogs like the Mac ([f223dc4](https://github.com/MasRama/ren-notes/commit/f223dc4880a1649fa1cb3f8fed9cf715853fdf3e))
* **app:** give the Linux window a rounded, shadowed frame ([f0aa89d](https://github.com/MasRama/ren-notes/commit/f0aa89d291048124e5e31bf3a2a83fb0b27bfd6f))
* **app:** grey the selected note while the window is in the background ([bb59d73](https://github.com/MasRama/ren-notes/commit/bb59d7336c3166c16a63e7d970cb7929f49fedfd))
* **app:** let the panes stretch past their ends and spring back ([9f9d0e0](https://github.com/MasRama/ren-notes/commit/9f9d0e0375c3b1fe997e4018de0c883c25932729))
* **app:** read a web page's title, site and picture for link cards ([c3ebfe4](https://github.com/MasRama/ren-notes/commit/c3ebfe4fb74b1dda46d396415ff1f9a0572c5a19))
* **app:** tint the sidebar with the wallpaper's colour ([e9f7c50](https://github.com/MasRama/ren-notes/commit/e9f7c503eb1e231434afe40197b22d129a7dde5f))
* **editor:** fold a heading's section away, as on the Mac ([16eaa9c](https://github.com/MasRama/ren-notes/commit/16eaa9c1a0d0acda7580fea4a2a2f73ee306de41))
* **editor:** highlight text in the Mac's five colours ([ac84a6a](https://github.com/MasRama/ren-notes/commit/ac84a6a22c51e5a724fc874eba85c5cd5a7f65e3))
* **editor:** set titles and headings at the Mac's sizes ([b0ce1ed](https://github.com/MasRama/ren-notes/commit/b0ce1ed1b2ed9fd9b4cc3c93de83dcbd3b28c168))
* **editor:** show a link pasted on its own line as a card ([a6e5923](https://github.com/MasRama/ren-notes/commit/a6e5923c43f9c6a4848d3a49fd94be86f904b3f5))
* **smart-folders:** draw the dialog's controls as on the Mac ([3768735](https://github.com/MasRama/ren-notes/commit/3768735b9903dce23010e18cb9271a0360438bb0))


### Bug Fixes

* **app:** dim the window whenever GNOME shows it in the background ([893b057](https://github.com/MasRama/ren-notes/commit/893b05723e753c0088020bafad44f4b6414038df))
* **app:** stop the framed window growing on every start ([5467e5d](https://github.com/MasRama/ren-notes/commit/5467e5d44087605e46b62334ad3250968d5c73b5))
* **smart-folders:** let smart folders be edited and saved with tags ([a0a076f](https://github.com/MasRama/ren-notes/commit/a0a076fe1b8555a55027364a8a1f0521913edcbd))

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
