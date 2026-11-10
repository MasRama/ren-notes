import type { Editor, JSONContent } from "@tiptap/core";
import type { Api } from "../../shared/ipc/api";

/** Stores files and puts them in the note: pictures inline, anything else as
 * a file card. At `pos`, or at the selection when `pos` is null. */
export async function insertFiles(editor: Editor, api: Api, files: File[], pos: number | null): Promise<void> {
  const nodes: JSONContent[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const a = await api.attachmentsAdd(bytes, file.name || "file");
    nodes.push(
      a.mime.startsWith("image/")
        ? { type: "image", attrs: { attachmentId: a.id, alt: a.fileName } }
        : { type: "attachment", attrs: { id: a.id, fileName: a.fileName, mime: a.mime, byteSize: a.byteSize } },
    );
  }
  if (!nodes.length || editor.isDestroyed) return;
  const at = pos ?? editor.state.selection.to;
  editor.chain().focus().insertContentAt(at, [...nodes, { type: "paragraph" }]).run();
}
