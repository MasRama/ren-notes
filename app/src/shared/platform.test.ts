import { describe, expect, it } from "vitest";
import { detectPlatform, protocolBase } from "./platform";

const EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36 Edg/142.0";
const WEBKITGTK = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

describe("detectPlatform", () => {
  it("knows WebView2 on Windows by its user agent", () => {
    expect(detectPlatform("", EDGE)).toBe("windows");
    expect(detectPlatform("", WEBKITGTK)).toBe("linux");
  });

  it("lets ?platform= pick one", () => {
    expect(detectPlatform("?platform=windows", WEBKITGTK)).toBe("windows");
    expect(detectPlatform("?theme=dark&platform=linux", EDGE)).toBe("linux");
    expect(detectPlatform("?platform=mac", WEBKITGTK)).toBe("linux");
  });
});

describe("protocolBase", () => {
  it("serves attachments over http on Windows", () => {
    expect(protocolBase("windows")).toBe("http://renotes.localhost");
    expect(protocolBase("linux")).toBe("renotes://localhost");
  });
});
