import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import { copyRules, EMPTY_RULES, openSmartDialog, smartDialog } from "./dialog";
import type { Rules } from "../../shared/ipc/types";

const rules = (): Rules => ({ ...EMPTY_RULES, tags: ["work", "launch"], tagMatch: "all", pinned: true });

describe("openSmartDialog", () => {
  it("opens on a smart folder taken from the store's reactive state", () => {
    const folder = reactive({ id: "s1", name: "This Week", rules: rules() });

    openSmartDialog(folder);

    expect(smartDialog).toMatchObject({ open: true, id: "s1", name: "This Week", rules: rules() });
    smartDialog.rules.tags.push("travel");
    expect(folder.rules.tags).toEqual(["work", "launch"]);
  });
});

describe("copyRules", () => {
  it("makes plain rules out of the dialog's reactive ones", () => {
    const edited = reactive(rules());

    const copy = copyRules(edited);

    expect(copy).toEqual(rules());
    expect(() => structuredClone(copy)).not.toThrow();
    copy.tags.push("travel");
    expect(edited.tags).toEqual(["work", "launch"]);
  });
});
