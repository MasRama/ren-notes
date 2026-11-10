import type { SaveNote } from "../../shared/ipc/types";

export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
}

export type DerivedFields = Omit<SaveNote, "docJson" | "keepTime">;

const SNIPPET_MAX = 300;
/** Nodes whose text forms one line (or several, with hard breaks). */
const TEXT_BLOCKS = new Set(["paragraph", "heading", "codeBlock"]);

function inlineText(node: DocNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(inlineText).join("");
}

/** What the list, search and the core need from a document: title (first
 * non-empty line), snippet (the lines after it), plain text, whether it has a
 * checklist, and the attachments it uses (in order, once each). */
export function deriveFields(doc: DocNode): DerivedFields {
  const blocks: string[] = [];
  const attachmentIds: string[] = [];
  let hasChecklist = false;

  const walk = (node: DocNode) => {
    if (node.type === "taskItem") hasChecklist = true;
    const id =
      node.type === "image"
        ? node.attrs?.attachmentId
        : node.type === "attachment"
          ? node.attrs?.id
          : node.type === "linkCard"
            ? node.attrs?.imageId
            : null;
    if (typeof id === "string" && id && !attachmentIds.includes(id)) attachmentIds.push(id);
    if (node.type === "linkCard") {
      // A card reads as its title, or its address when the page had none.
      blocks.push(String(node.attrs?.title || node.attrs?.url || ""));
      return;
    }
    if (TEXT_BLOCKS.has(node.type)) {
      blocks.push(inlineText(node));
      return;
    }
    node.content?.forEach(walk);
  };
  walk(doc);

  const plainText = blocks.join("\n");
  const lines = plainText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const title = lines[0] ?? "";
  const snippet = lines.slice(1).join(" ").slice(0, SNIPPET_MAX);
  return { title, snippet, plainText: plainText.trim() ? plainText : "", hasChecklist, attachmentIds };
}
