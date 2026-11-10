import { afterEach, describe, expect, it } from "vitest";
import { createApp, nextTick } from "vue";
import { passwordSheet, type PasswordValues } from "./flow";
import PasswordSheet from "./PasswordSheet.vue";

let unmount: (() => void) | null = null;
afterEach(() => {
  unmount?.();
  passwordSheet.request = null;
  document.body.innerHTML = "";
});

async function show(mode: "create" | "enter", answer: (v: PasswordValues) => string | null) {
  const seen: PasswordValues[] = [];
  const closed: boolean[] = [];
  passwordSheet.request = {
    mode,
    submit: async (v) => {
      seen.push(v);
      return answer(v);
    },
    done: (ok) => {
      closed.push(ok);
      passwordSheet.request = null;
    },
  };
  const el = document.createElement("div");
  document.body.append(el);
  const app = createApp(PasswordSheet);
  app.mount(el);
  unmount = () => app.unmount();
  await nextTick();
  return { el, seen, closed };
}

function fill(el: HTMLElement, name: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
}
const submit = (el: HTMLElement) =>
  el.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("PasswordSheet", () => {
  it("asks for a new password twice and a hint, and shows what went wrong", async () => {
    const { el, seen } = await show("create", () => "The passwords don’t match.");
    expect(el.querySelector("h2")?.textContent).toBe("Create a password for locked notes");
    fill(el, "password", "a");
    fill(el, "verify", "b");
    fill(el, "hint", "h");
    submit(el);
    await flush();
    expect(seen).toEqual([{ password: "a", verify: "b", hint: "h" }]);
    expect(el.querySelector(".error")?.textContent).toBe("The passwords don’t match.");
  });

  it("asks once for the password when locked notes are closed", async () => {
    const { el, seen } = await show("enter", () => null);
    expect(el.querySelectorAll("input")).toHaveLength(1);
    fill(el, "password", "hunter2");
    submit(el);
    await flush();
    expect(seen[0].password).toBe("hunter2");
  });

  it("closes without opening on Cancel and Escape", async () => {
    const { el, closed } = await show("enter", () => null);
    el.querySelector<HTMLElement>(".cancel")!.click();
    expect(closed).toEqual([false]);
    const again = await show("enter", () => null);
    again.el.querySelector("form")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(again.closed).toEqual([false]);
  });
});
