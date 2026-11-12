/** The desktop the window runs on. Linux is the default; `?platform=` picks
 * one in a plain browser, for screenshots of the other's chrome. */
export type Platform = "linux" | "windows";

export function detectPlatform(search: string, userAgent: string): Platform {
  const forced = new URLSearchParams(search).get("platform");
  if (forced === "linux" || forced === "windows") return forced;
  return /\bWindows\b/.test(userAgent) ? "windows" : "linux";
}

let cached: Platform | null = null;

export function platform(): Platform {
  cached ??= detectPlatform(location.search, navigator.userAgent);
  return cached;
}

/** Where the `renotes` protocol is served: WebView2 has no custom schemes,
 * so Tauri serves it over http there. */
export function protocolBase(on: Platform): string {
  return on === "windows" ? "http://renotes.localhost" : "renotes://localhost";
}
