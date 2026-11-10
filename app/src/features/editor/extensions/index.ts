import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { AttachmentCard, NoteImage, type NodeOptions } from "./nodes";
import { NoteBulletList } from "./lists";
import { NoteShortcuts, type ShortcutOptions } from "./shortcuts";
import { SearchHighlight, TagHighlight } from "./highlight";
import { SinkChecked } from "./checklist";
import { NoteHighlight } from "./colors";
import { HeadingFolding } from "./folding";
import { LinkCard } from "./linkCard";
import { MathResults } from "./math";
import { NoteLink, type NoteLinkOptions } from "./noteLink";

export type EditorOptions = NodeOptions &
  ShortcutOptions & {
    /** Whether checked items move to the bottom of their checklist. */
    sinkChecked?: () => boolean;
    /** Opens a web page in the browser. */
    openLink?: (url: string) => void;
    /** Links to other notes: their titles, opening them, the `>>` picker. */
    noteLinks?: Partial<NoteLinkOptions>;
  };

/** The editor's schema and behaviour. Used by the app and by tests. */
export function noteExtensions(options: EditorOptions): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      bulletList: false,
      link: { openOnClick: false, autolink: true, linkOnPaste: true, HTMLAttributes: { rel: "noopener" } },
      codeBlock: { HTMLAttributes: { class: "rn-mono" } },
    }),
    NoteBulletList,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    NoteImage.configure({ attachmentUrl: options.attachmentUrl, openAttachment: options.openAttachment }),
    AttachmentCard.configure({ attachmentUrl: options.attachmentUrl, openAttachment: options.openAttachment }),
    LinkCard.configure({ attachmentUrl: options.attachmentUrl, openLink: options.openLink ?? (() => {}) }),
    NoteShortcuts.configure({ toggleChecked: options.toggleChecked }),
    SinkChecked.configure({ enabled: options.sinkChecked ?? (() => true) }),
    NoteHighlight,
    HeadingFolding,
    MathResults,
    NoteLink.configure(options.noteLinks ?? {}),
    TagHighlight,
    SearchHighlight,
  ];
}
