/** The desktop tint: the wallpaper's average colour, of which the sidebar
 * takes only the hue and a little of the saturation (theme.css), the way
 * the Mac tints windows with the wallpaper. */

export interface Tint {
  hue: number;
  saturation: number;
}

export function tintOf(hex: string): Tint | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { hue: 0, saturation: 0 };
  const light = (max + min) / 2;
  const saturation = d / (light > 0.5 ? 2 - max - min : max + min);
  let hue: number;
  if (max === r) hue = ((g - b) / d + 6) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return { hue: Math.round(hue * 60) % 360, saturation: Math.round(saturation * 100) };
}

export function applyTint(root: HTMLElement, hex: string | null): void {
  const tint = hex ? tintOf(hex) : null;
  if (tint) {
    root.style.setProperty("--tint-h", String(tint.hue));
    root.style.setProperty("--tint-s", `${tint.saturation}%`);
  } else {
    root.style.removeProperty("--tint-h");
    root.style.removeProperty("--tint-s");
  }
}
