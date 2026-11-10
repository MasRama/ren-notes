import { Node } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";

/** `>>` and what is typed after it, which the picker searches notes for. */
export interface NoteLinkQuery {
  from: number;
  to: number;
  text: string;
}

export interface NoteLinkOptions {
  /** A note's current title; undefined when it is gone. Leave null when
   * titles are not known (tests, previews): the stored title is shown. */
  noteTitle: ((id: string) => string | undefined) | null;
  openNote: (id: string) => void;
  /** Called when `>>` starts, changes or ends (null). */
  onQuery: (query: NoteLinkQuery | null) => void;
  /** Keys typed while the picker is open; true when the picker took it. */
  onKey: (event: KeyboardEvent) => boolean;
}

/** Longest query looked for after `>>`. */
const QUERY_MAX = 40;

/** The `>>` the cursor is typing after, if any. */
export function linkTrigger(state: EditorState): NoteLinkQuery | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) return null;
  const before = $from.parent.textBetween(
    Math.max(0, $from.parentOffset - QUERY_MAX - 2),
    $from.parentOffset,
    undefined,
    "￼",
  );
  const match = new RegExp(`>>([^>\\ufffc\\n]{0,${QUERY_MAX}})$`).exec(before);
  if (!match) return null;
  return { from: $from.pos - match[0].length, to: $from.pos, text: match[1] };
}

/** Letters and digits only, lowercased, accents gone: "Wi-Fi" is "wifi". */
const bare = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

/** Whether a note's title is one the picker offers for what was typed. */
export function titleMatches(title: string, typed: string): boolean {
  return bare(title).includes(bare(typed));
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    noteLink: {
      /** Replaces `>>` and its query with a link to the note. */
      insertNoteLink: (note: { id: string; title: string }, range: { from: number; to: number }) => ReturnType;
    };
  }
}

const key = new PluginKey("noteLinkTrigger");

/** A link to another note, as on the Mac: typing `>>` offers the notes, and
 * the link shows the note's title and opens it when clicked. */
export const NoteLink = Node.create<NoteLinkOptions>({
  name: "noteLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  addOptions() {
    return { noteTitle: null, openNote: () => {}, onQuery: () => {}, onKey: () => false };
  },
  addAttributes() {
    return {
      id: { default: "", parseHTML: (el) => el.getAttribute("data-note-id") ?? "", renderHTML: () => ({}) },
      title: { default: "", parseHTML: (el) => el.textContent ?? "", renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-note-id]" }];
  },
  renderHTML({ node }) {
    return ["span", { "data-note-id": node.attrs.id, class: "rn-note-link" }, node.attrs.title];
  },
  renderText({ node }) {
    return node.attrs.title;
  },
  addNodeView() {
    return ({ node }) => {
      const id = node.attrs.id as string;
      const dom = document.createElement("span");
      dom.className = "rn-note-link";
      dom.dataset.noteId = id;
      const known = this.options.noteTitle;
      const current = known ? known(id) : undefined;
      dom.textContent = current ?? (node.attrs.title as string);
      if (known && current === undefined) dom.classList.add("missing");
      dom.addEventListener("click", (event) => {
        event.preventDefault();
        this.options.openNote(id);
      });
      return { dom };
    };
  },
  addCommands() {
    return {
      insertNoteLink:
        (note, range) =>
        ({ state, tr, dispatch }) => {
          if (dispatch) tr.replaceWith(range.from, range.to, [this.type.create(note), state.schema.text(" ")]);
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    const options = this.options;
    // Escape closes the picker until the cursor leaves that `>>`.
    let dismissed: number | null = null;
    let shown: string | null = null;
    const report = (query: NoteLinkQuery | null) => {
      const seen = query && query.from === dismissed ? null : query;
      if (!query) dismissed = null;
      const id = seen && JSON.stringify(seen);
      if (id === shown) return;
      shown = id;
      options.onQuery(seen);
    };
    return [
      new Plugin({
        key,
        view: (view) => {
          report(linkTrigger(view.state));
          return {
            update: (v) => report(view.editable ? linkTrigger(v.state) : null),
            destroy: () => report(null),
          };
        },
        props: {
          handleKeyDown(view, event) {
            if (!shown) return false;
            if (event.key === "Escape") {
              dismissed = linkTrigger(view.state)?.from ?? null;
              report(linkTrigger(view.state));
              return true;
            }
            return options.onKey(event);
          },
        },
      }),
    ];
  },
});
