import { mergeAttributes, Node } from "@tiptap/core";
import Image from "@tiptap/extension-image";

export interface NodeOptions {
  /** URL that serves an attachment's bytes. */
  attachmentUrl: (id: string) => string;
  /** Opens a file attachment in the system's app for it. */
  openAttachment: (id: string) => void;
}

/** Pictures stored as attachments: the document keeps the id, not a URL, so
 * notes survive the library moving. `size` is "large" (fills the width) or
 * "small". */
export const NoteImage = Image.extend<NodeOptions & { inline: boolean; allowBase64: boolean; HTMLAttributes: Record<string, unknown>; resize: false }>({
  addOptions() {
    return {
      ...this.parent!(),
      attachmentUrl: () => "",
      openAttachment: () => {},
    };
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      attachmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-attachment-id"),
        renderHTML: (attrs) => (attrs.attachmentId ? { "data-attachment-id": attrs.attachmentId } : {}),
      },
      size: {
        default: "large",
        parseHTML: (el) => el.getAttribute("data-size") ?? "large",
        renderHTML: (attrs) => ({ "data-size": attrs.size }),
      },
    };
  },
  renderHTML({ HTMLAttributes, node }) {
    const id = node.attrs.attachmentId as string | null;
    const src = id ? this.options.attachmentUrl(id) : HTMLAttributes.src;
    return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { src, class: "rn-image", draggable: "true" })];
  },
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

function kindLabel(fileName: string, mime: string): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toUpperCase() : "";
  if (mime === "application/pdf") return "PDF document";
  if (mime.startsWith("audio/")) return `${ext || "Audio"} audio`;
  if (mime.startsWith("video/")) return `${ext || "Video"} video`;
  if (mime.startsWith("text/")) return `${ext || "Text"} text`;
  return ext ? `${ext} file` : "File";
}

/** A file in a note, drawn as a card; double-click opens it. */
export const AttachmentCard = Node.create<NodeOptions>({
  name: "attachment",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addOptions() {
    return { attachmentUrl: () => "", openAttachment: () => {} };
  },
  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute("data-id") },
      fileName: { default: "file", parseHTML: (el) => el.getAttribute("data-file-name") },
      mime: { default: "application/octet-stream", parseHTML: (el) => el.getAttribute("data-mime") },
      byteSize: { default: 0, parseHTML: (el) => Number(el.getAttribute("data-byte-size") ?? 0) },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type=attachment]" }];
  },
  renderHTML({ node }) {
    return [
      "div",
      {
        "data-type": "attachment",
        "data-id": node.attrs.id,
        "data-file-name": node.attrs.fileName,
        "data-mime": node.attrs.mime,
        "data-byte-size": node.attrs.byteSize,
      },
      node.attrs.fileName,
    ];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.className = "rn-attachment";
      dom.contentEditable = "false";
      dom.dataset.type = "attachment";
      const icon = document.createElement("div");
      icon.className = "rn-attachment-icon";
      const ext = String(node.attrs.fileName).split(".").pop() ?? "";
      icon.textContent = ext.length <= 4 ? ext.toUpperCase() : "FILE";
      const text = document.createElement("div");
      text.className = "rn-attachment-text";
      const name = document.createElement("div");
      name.className = "rn-attachment-name";
      name.textContent = node.attrs.fileName;
      const meta = document.createElement("div");
      meta.className = "rn-attachment-meta";
      meta.textContent = `${kindLabel(node.attrs.fileName, node.attrs.mime)} · ${formatSize(node.attrs.byteSize)}`;
      text.append(name, meta);
      dom.append(icon, text);
      dom.addEventListener("dblclick", () => node.attrs.id && this.options.openAttachment(node.attrs.id));
      return { dom };
    };
  },
});
