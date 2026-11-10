import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findTags } from "../../../shared/tags";

export interface Range {
  from: number;
  to: number;
}

const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

/** Where `terms` start words in `text`, ignoring case and accents. Offsets
 * are UTF-16 positions in `text`, sorted. */
export function findMatches(text: string, terms: string[]): Range[] {
  const wanted = terms.map(fold).filter(Boolean);
  if (!wanted.length) return [];
  // Fold character by character so every folded index maps back to text.
  let folded = "";
  const origin: number[] = [];
  const width: number[] = [];
  let offset = 0;
  for (const ch of text) {
    const f = fold(ch);
    for (let i = 0; i < f.length; i++) {
      origin.push(offset);
      width.push(ch.length);
    }
    folded += f;
    offset += ch.length;
  }
  const found: Range[] = [];
  for (const term of wanted) {
    let at = folded.indexOf(term);
    while (at !== -1) {
      const from = origin[at];
      if (!isWord(text[from - 1])) {
        const last = at + term.length - 1;
        found.push({ from, to: origin[last] + width[last] });
      }
      at = folded.indexOf(term, at + 1);
    }
  }
  return found.sort((a, b) => a.from - b.from);
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function decorateText(state: EditorState, ranges: (text: string) => Range[], cls: string): DecorationSet {
  const decorations: Decoration[] = [];
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const r of ranges(node.text)) {
      decorations.push(Decoration.inline(pos + r.from, pos + r.to, { class: cls }));
    }
  });
  return DecorationSet.create(state.doc, decorations);
}

/** Colours `#tags` as you type them. */
export const TagHighlight = Extension.create({
  name: "tagHighlight",
  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>("tagHighlight");
    return [
      new Plugin({
        key,
        state: {
          init: (_, state) => decorateText(state, findTags, "rn-tag"),
          apply: (tr, old, _o, state) => (tr.docChanged ? decorateText(state, findTags, "rn-tag") : old),
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ];
  },
});

const searchKey = new PluginKey<{ terms: string[]; set: DecorationSet }>("searchHighlight");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchHighlight: {
      /** Marks these words wherever they start a word; [] clears. */
      setSearchTerms: (terms: string[]) => ReturnType;
    };
  }
}

/** Marks the words of the current search in the open note. */
export const SearchHighlight = Extension.create({
  name: "searchHighlight",
  addCommands() {
    return {
      setSearchTerms:
        (terms) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(searchKey, terms).setMeta("addToHistory", false);
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    const build = (state: EditorState, terms: string[]) =>
      decorateText(state, (text) => findMatches(text, terms), "rn-match");
    return [
      new Plugin({
        key: searchKey,
        state: {
          init: (): { terms: string[]; set: DecorationSet } => ({ terms: [], set: DecorationSet.empty }),
          apply: (tr, old, _o, state) => {
            const terms = tr.getMeta(searchKey) as string[] | undefined;
            if (terms) return { terms, set: build(state, terms) };
            if (tr.docChanged) return { terms: old.terms, set: build(state, old.terms) };
            return old;
          },
        },
        props: { decorations: (state) => searchKey.getState(state)?.set },
      }),
    ];
  },
});
