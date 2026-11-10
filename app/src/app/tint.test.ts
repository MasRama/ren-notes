import { describe, expect, it } from "vitest";
import { applyTint, tintOf } from "./tint";

describe("tintOf", () => {
  it("takes the hue and saturation of the wallpaper's colour", () => {
    expect(tintOf("#023c88")).toEqual({ hue: 214, saturation: 97 });
    expect(tintOf("#d08c4a")).toEqual({ hue: 30, saturation: 59 });
  });

  it("gives grey no saturation", () => {
    expect(tintOf("#777777")).toEqual({ hue: 0, saturation: 0 });
  });

  it("ignores anything that is not #rrggbb", () => {
    expect(tintOf("blue")).toBeNull();
    expect(tintOf("#12345")).toBeNull();
  });
});

describe("applyTint", () => {
  it("sets the tint on the page and takes it off again", () => {
    const root = document.createElement("div");
    applyTint(root, "#023c88");
    expect(root.style.getPropertyValue("--tint-h")).toBe("214");
    expect(root.style.getPropertyValue("--tint-s")).toBe("97%");

    applyTint(root, null);
    expect(root.style.getPropertyValue("--tint-h")).toBe("");
    expect(root.style.getPropertyValue("--tint-s")).toBe("");
  });
});
