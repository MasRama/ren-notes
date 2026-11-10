// Mirrors of the core's serialized types (camelCase on the wire).

export const DEFAULT_FOLDER_ID = "notes";

export interface Folder {
  id: string;
  parentId: string | null;
  name: string;
  sortIndex: number;
  noteCount: number;
  isDefault: boolean;
}

export interface NoteSummary {
  id: string;
  folderId: string;
  title: string;
  snippet: string;
  firstImageId: string | null;
  pinned: boolean;
  hasChecklist: boolean;
  hasAttachment: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type DocFormat = "tiptap" | "legacy_html";

export interface Note extends NoteSummary {
  docJson: string;
  docFormat: DocFormat;
}

export interface SaveNote {
  docJson: string;
  title: string;
  snippet: string;
  plainText: string;
  hasChecklist: boolean;
  attachmentIds: string[];
  keepTime?: boolean;
}

export type NoteFilter =
  | { kind: "all" }
  | { kind: "folder"; value: string }
  | { kind: "tags"; value: string[] }
  | { kind: "trash" };

export type NoteSort = "edited" | "created" | "title";

export interface TagCount {
  tag: string;
  count: number;
}

export type TagMatch = "any" | "all";

export interface Rules {
  tags: string[];
  tagMatch: TagMatch;
  editedWithinDays: number | null;
  createdWithinDays: number | null;
  hasChecklist: boolean;
  hasAttachment: boolean;
  pinned: boolean;
}

export interface SmartFolder {
  id: string;
  name: string;
  rules: Rules;
  sortIndex: number;
}

export interface Attachment {
  id: string;
  mime: string;
  fileName: string;
  byteSize: number;
  width: number | null;
  height: number | null;
}

/** A web page as a link card shows it; the picture is an attachment. */
export interface LinkPreview {
  url: string;
  title: string | null;
  site: string;
  imageId: string | null;
}

export interface ImportReport {
  folders: number;
  notes: number;
}

/** An error from the core: `code` is stable, `message` is for people. */
export interface CoreError {
  code: "not_found" | "invalid_input" | "name_taken" | "forbidden" | "db" | "io" | "json";
  message: string;
}
