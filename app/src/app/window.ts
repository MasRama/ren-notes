import { isTauri } from "../shared/ipc/api";

type AppWindow = import("@tauri-apps/api/window").Window;

let cached: Promise<AppWindow | null> | null = null;

/** The Tauri window, or null in a plain browser (tests, screenshots). */
export function appWindow(): Promise<AppWindow | null> {
  cached ??= isTauri()
    ? import("@tauri-apps/api/window").then((m) => m.getCurrentWindow())
    : Promise.resolve(null);
  return cached;
}

/** Opens a web link with the system browser. */
export async function openLink(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}
