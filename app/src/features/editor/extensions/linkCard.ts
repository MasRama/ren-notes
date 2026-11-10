import { Node, mergeAttributes } from "@tiptap/core";

/** What a link card shows, as the app's `linkPreview` answers it. */
export interface LinkPreviewAttrs {
  url: string;
  title: string | null;
  site: string;
  imageId: string | null;
}

export interface LinkCardOptions {
  attachmentUrl: (id: string) => string;
  openLink: (url: string) => void;
}

/** The web address in pasted text, when the text is nothing else. */
export function pastedUrl(text: string): string | null {
  const candidate = text.trim();
  if (!/^https?:\/\/\S+$/i.test(candidate)) return null;
  try {
    return new URL(candidate).hostname ? candidate : null;
  } catch {
    return null;
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linkCard: {
      /** Turns the top-level line holding only this preview's address into
       * its card; false when no line holds just that address. */
      showLinkPreview: (preview: LinkPreviewAttrs) => ReturnType;
      /** Turns the card at `pos` back into its address as a plain link. */
      showAsLink: (pos: number) => ReturnType;
    };
  }
}

const data = (key: string) => ({
  parseHTML: (el: HTMLElement) => el.getAttribute(`data-${key}`) || null,
  renderHTML: () => ({}),
});

/** A web page as a card, the way the Mac shows a pasted link: its picture,
 * title and site. Clicking it opens the page. */
export const LinkCard = Node.create<LinkCardOptions>({
  name: "linkCard",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addOptions() {
    return { attachmentUrl: () => "", openLink: () => {} };
  },
  addAttributes() {
    return {
      url: { default: "", ...data("url") },
      title: { default: null, ...data("title") },
      site: { default: "", ...data("site") },
      imageId: { default: null, ...data("image-id") },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="link-card"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const { url, title, site, imageId } = node.attrs as LinkPreviewAttrs;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "link-card",
        "data-url": url,
        "data-title": title ?? "",
        "data-site": site,
        "data-image-id": imageId ?? "",
      }),
      ["a", { href: url, rel: "noopener" }, title || url],
    ];
  },
  addNodeView() {
    return ({ node }) => {
      const { url, title, site, imageId } = node.attrs as LinkPreviewAttrs;
      const dom = document.createElement("div");
      dom.className = "rn-link-card";
      dom.contentEditable = "false";
      dom.title = url;
      if (imageId) {
        const img = document.createElement("img");
        img.className = "rn-link-image";
        img.src = this.options.attachmentUrl(imageId);
        img.alt = "";
        img.draggable = false;
        dom.append(img);
      } else {
        dom.classList.add("bare");
      }
      const text = document.createElement("div");
      text.className = "rn-link-text";
      const name = document.createElement("div");
      name.className = "rn-link-title";
      name.textContent = title || url;
      const from = document.createElement("div");
      from.className = "rn-link-site";
      from.textContent = site;
      text.append(name, from);
      dom.append(text);
      dom.addEventListener("click", () => this.options.openLink(url));
      return { dom };
    };
  },
  addCommands() {
    return {
      showLinkPreview:
        (preview) =>
        ({ state, tr, dispatch }) => {
          let at = -1;
          state.doc.forEach((node, offset) => {
            if (at < 0 && node.type.name === "paragraph" && node.textContent.trim() === preview.url) at = offset;
          });
          if (at < 0) return false;
          const line = state.doc.nodeAt(at)!;
          if (dispatch) tr.replaceWith(at, at + line.nodeSize, this.type.create(preview));
          return true;
        },
      showAsLink:
        (pos) =>
        ({ state, tr, dispatch }) => {
          const card = state.doc.nodeAt(pos);
          if (card?.type !== this.type) return false;
          const url = card.attrs.url as string;
          const link = state.schema.marks.link?.create({ href: url });
          const line = state.schema.nodes.paragraph.create(null, state.schema.text(url, link ? [link] : []));
          if (dispatch) tr.replaceWith(pos, pos + card.nodeSize, line);
          return true;
        },
    };
  },
});
