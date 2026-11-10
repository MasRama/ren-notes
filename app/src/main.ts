import { createApp } from "vue";
import "@fontsource-variable/inter";
import "./styles/theme.css";
import "./styles/editor.css";
import App from "./app/App.vue";
import { StoreKey } from "./app/context";
import { Store } from "./app/store";
import { isTauri, setApi, type Api } from "./shared/ipc/api";

async function boot() {
  let api: Api;
  if (isTauri()) {
    const { tauriApi } = await import("./shared/ipc/tauri");
    api = tauriApi();
    document.documentElement.classList.add("framed");
  } else {
    const { demoApi } = await import("./shared/ipc/demo");
    api = demoApi(new URLSearchParams(location.search));
  }
  setApi(api);
  const store = new Store(api);
  // The session is restored before the first paint: no flash of defaults.
  await store.init();
  createApp(App).provide(StoreKey, store).mount("#app");
}

void boot();
