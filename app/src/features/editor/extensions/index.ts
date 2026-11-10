import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { AttachmentCard, NoteImage, type NodeOptions } from "./nodes";
import { NoteBulletList } from "./lists";
import { NoteShortcuts, type ShortcutOptions } from "./shortcuts";
import { SearchHighlight, TagHighlight } from "./highlight";

export type EditorOptions = NodeOptions & ShortcutOptions;

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
    NoteShortcuts.configure({ toggleChecked: options.toggleChecked }),
    TagHighlight,
    SearchHighlight,
  ];
}
