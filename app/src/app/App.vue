<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from "vue";
import { currentEditor, signals, useStore } from "./context";
import { appWindow } from "./window";
import { applyTint } from "./tint";
import { api } from "../shared/ipc/api";
import WindowControls from "./WindowControls.vue";
import Splitter from "./Splitter.vue";
import Icon from "../shared/ui/Icon.vue";
import ContextMenu from "../shared/ui/ContextMenu.vue";
import AlertDialog from "../shared/ui/AlertDialog.vue";
import PasswordSheet from "../features/locks/PasswordSheet.vue";
import { closeWhenIdle } from "../features/locks/autoLock";
import Sidebar from "../features/sidebar/Sidebar.vue";
import NoteList from "../features/note-list/NoteList.vue";
import Gallery from "../features/note-list/Gallery.vue";
import EditorPane from "../features/editor/EditorPane.vue";
import SmartFolderDialog from "../features/smart-folders/SmartFolderDialog.vue";
import { inDialog, shortcut } from "../shared/keyboard";

const store = useStore();
const s = store.state;

const windowActive = ref(true);
const maximized = ref(false);
const framed = document.documentElement.classList.contains("framed");

const showList = computed(() => s.view === "list");
// With the sidebar hidden the window controls sit over the list, so the list
// grows by their width and keeps the room it had for its own title.
const CHROME_W = 110;
const listExtra = computed(() => (s.sidebarShown ? 0 : CHROME_W));
const showEditor = computed(() => s.view === "list" || s.galleryOpen);

watchEffect(() => {
  const root = document.documentElement;
  if (s.theme === "system") delete root.dataset.theme;
  else root.dataset.theme = s.theme;
});

function toggleSidebar() {
  s.sidebarShown = !s.sidebarShown;
  if (!s.sidebarShown && s.focus === "sidebar") s.focus = "list";
  store.persist();
}

async function onKey(e: KeyboardEvent) {
  const command = shortcut(e);
  if (!command) {
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && s.focus !== "editor" && !inDialog(e.target)) {
      // Tab moves between the sidebar and the list; the editor keeps Tab.
      e.preventDefault();
      s.focus = s.focus === "sidebar" ? "list" : e.shiftKey && s.sidebarShown ? "sidebar" : "editor";
      if (s.focus === "editor") s.focusEditor++;
      if (s.focus === "list") signals.focusList++;
    }
    return;
  }
  e.preventDefault();
  switch (command) {
    case "newNote":
      if (store.inTrash) return;
      await store.newNote();
      break;
    case "newFolder":
      if (!s.sidebarShown) toggleSidebar();
      await store.newFolder(null);
      break;
    case "search":
      signals.focusSearch++;
      break;
    case "findInNote":
      if (currentEditor.value) signals.findInNote++;
      break;
    case "toggleSidebar":
      toggleSidebar();
      break;
    case "listView":
      store.setView("list");
      break;
    case "galleryView":
      store.setView("gallery");
      break;
  }
}

let unlisten: Array<() => void> = [];

// The wallpaper may have changed while the window was in the background.
function refreshTint() {
  api()
    .desktopTint()
    .then((hex) => applyTint(document.documentElement, hex))
    .catch(() => applyTint(document.documentElement, null));
}

onMounted(async () => {
  window.addEventListener("keydown", onKey);
  unlisten.push(closeWhenIdle(store, window));
  refreshTint();
  const win = await appWindow();
  if (!win) return;
  maximized.value = await win.isMaximized();
  const { listen } = await import("@tauri-apps/api/event");
  unlisten.push(
    // From the frame (frame.rs), so the page dims exactly when its shadow does.
    await listen<boolean>("renotes:active", ({ payload }) => {
      windowActive.value = payload;
      if (payload) refreshTint();
    }),
    await win.onResized(async () => (maximized.value = await win.isMaximized())),
    await win.onCloseRequested(async () => {
      await store.beforeLeave?.();
      await store.persistNow();
    }),
  );
  await win.show();
  await win.setFocus();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  unlisten.forEach((u) => u());
});
</script>

<template>
  <div
    class="window"
    :class="{ framed: framed && !maximized, inactive: !windowActive, translucent: s.translucentSidebar }"
    @contextmenu.prevent
  >
    <div class="chrome">
      <WindowControls :active="windowActive" />
      <button class="tool" :class="{ on: s.sidebarShown }" title="Show or hide the sidebar (Ctrl+Alt+S)" @click="toggleSidebar">
        <Icon name="sidebar" />
      </button>
    </div>

    <div class="sidebar-slot" :style="{ width: s.sidebarShown ? `${s.sidebarWidth}px` : '0px' }">
      <Sidebar :style="{ width: `${s.sidebarWidth}px` }" />
    </div>
    <Splitter
      v-if="s.sidebarShown"
      :width="s.sidebarWidth"
      :min="180"
      :max="320"
      @resize="(w) => (s.sidebarWidth = w)"
      @done="store.persist()"
    />

    <Transition name="swap" mode="out-in">
      <div v-if="showEditor" key="editing" class="panes">
        <template v-if="showList">
          <NoteList :style="{ width: `${s.listWidth + listExtra}px` }" :chrome-pad="!s.sidebarShown" />
          <Splitter
            :width="s.listWidth + listExtra"
            :min="240 + listExtra"
            :max="420 + listExtra"
            @resize="(w) => (s.listWidth = w - listExtra)"
            @done="store.persist()"
          />
        </template>
        <EditorPane :chrome-pad="!s.sidebarShown && !showList" />
      </div>
      <Gallery v-else key="gallery" class="panes" :chrome-pad="!s.sidebarShown" />
    </Transition>

    <ContextMenu />
    <AlertDialog />
    <PasswordSheet />
    <SmartFolderDialog />
    <Transition name="notice">
      <div v-if="s.notice" class="notice" role="status" @click="s.notice = null">{{ s.notice }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.window {
  position: relative;
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--window);
}
.window.framed {
  border-radius: 10px;
}
.window.inactive :deep(.sidebar) {
  background: var(--sidebar-flat);
}
/* The desktop shows through the sidebar; the list and the note keep their
   own backgrounds. Behind other windows it goes flat, as on the Mac. */
.window.translucent {
  background: transparent;
}
.window.translucent:not(.inactive) :deep(.sidebar) {
  background: var(--sidebar-glass);
}
.window.translucent .panes {
  background: var(--window);
}
/* The sidebar's edge: a shade darker than the glass it closes. */
.window.translucent:not(.inactive) > .splitter {
  background: linear-gradient(var(--glass-edge), var(--glass-edge)), var(--sidebar-glass);
  background-clip: content-box;
}
/* Behind other windows the selection goes grey, even in the focused pane. */
.window.inactive :deep(.focused .row.selected) {
  background: var(--select-2);
  color: var(--text);
}
/* The light inner edge dark windows have on the Mac. Drawn over the panes,
   whose own backgrounds would cover an inset shadow. */
.window.framed::after {
  content: "";
  position: absolute;
  z-index: 100;
  inset: 0;
  border: 1px solid var(--frame);
  border-radius: inherit;
  pointer-events: none;
}
.chrome {
  position: absolute;
  z-index: 20;
  top: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.tool {
  width: 30px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--text-2);
}
.tool:hover {
  background: var(--hover);
}
.tool:active {
  background: var(--press);
}
.sidebar-slot {
  flex: none;
  overflow: hidden;
  transition: width 250ms var(--ease-out);
}
.panes {
  flex: 1;
  min-width: 0;
  display: flex;
}
.swap-enter-active,
.swap-leave-active {
  transition: opacity 150ms ease;
}
.swap-enter-from,
.swap-leave-to {
  opacity: 0;
}
.notice {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--menu);
  backdrop-filter: var(--menu-blur);
  box-shadow: var(--shadow-pop);
  font-size: 12px;
  z-index: 50;
}
.notice-enter-active,
.notice-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms var(--ease-out);
}
.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}
</style>
