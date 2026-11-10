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

export function openSmartDialog(edit?: { id: string; name: string; rules: Rules }): void {
  Object.assign(smartDialog, {
    open: true,
    id: edit?.id ?? null,
    name: edit?.name ?? "",
    rules: structuredClone(edit?.rules ?? EMPTY_RULES),
  });
}
