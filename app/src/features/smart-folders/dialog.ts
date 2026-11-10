import { reactive } from "vue";
import type { Rules } from "../../shared/ipc/types";

export const EMPTY_RULES: Rules = {
  tags: [],
  tagMatch: "any",
  editedWithinDays: null,
  createdWithinDays: null,
  hasChecklist: false,
  hasAttachment: false,
  pinned: false,
};

/** The smart folder being made or edited, if the dialog is open. */
export const smartDialog = reactive({
  open: false,
  id: null as string | null,
  name: "",
  rules: { ...EMPTY_RULES } as Rules,
});

/** A plain copy of rules. structuredClone cannot copy Vue's reactive
 * proxies, and rules hold only flat values and a list of tags. */
export function copyRules(rules: Rules): Rules {
  return { ...rules, tags: [...rules.tags] };
}

export function openSmartDialog(edit?: { id: string; name: string; rules: Rules }): void {
  Object.assign(smartDialog, {
    open: true,
    id: edit?.id ?? null,
    name: edit?.name ?? "",
    rules: copyRules(edit?.rules ?? EMPTY_RULES),
  });
}
