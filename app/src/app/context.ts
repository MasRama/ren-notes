import type { Editor } from "@tiptap/core";
import { inject, reactive, shallowRef, type InjectionKey } from "vue";
import type { Store } from "./store";

export const StoreKey: InjectionKey<Store> = Symbol("store");

export function useStore(): Store {
  const store = inject(StoreKey);
  if (!store) throw new Error("no store provided");
  return store;
}

/** The open note's editor, for the toolbar's buttons. */
export const currentEditor = shallowRef<Editor | null>(null);

/** Requests between panes that are not state: focus the search field, open
 * the file chooser, show find-in-note, start a drawing. Each is a counter to
 * watch. */
export const signals = reactive({ focusSearch: 0, attachFile: 0, findInNote: 0, focusList: 0, newSketch: 0 });
