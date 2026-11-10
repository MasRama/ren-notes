use serde::{Deserialize, Serialize};

/// What a new note holds: one empty paragraph, in the editor's JSON format.
pub const EMPTY_DOC: &str = r#"{"type":"doc","content":[{"type":"paragraph"}]}"#;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocFormat {
    /// The editor's own JSON document.
    Tiptap,
    /// HTML imported from the old app, converted when the note is first opened.
    LegacyHtml,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSummary {
    pub id: String,
    pub folder_id: String,
    pub title: String,
    pub snippet: String,
    pub first_image_id: Option<String>,
    pub pinned: bool,
    pub has_checklist: bool,
    pub has_attachment: bool,
    /// Sealed with the notes password: only the title is in the clear.
    pub locked: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    #[serde(flatten)]
    pub summary: NoteSummary,
    pub doc_json: String,
    pub doc_format: DocFormat,
}

/// What the editor sends on every save. The page derives the fields from the
/// document; the core checks and limits them.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveNote {
    pub doc_json: String,
    pub title: String,
    pub snippet: String,
    pub plain_text: String,
    pub has_checklist: bool,
    pub attachment_ids: Vec<String>,
    /// Keep the edit time, for saves that are not edits (converting a note
    /// imported from the old app when it is first opened).
    #[serde(default)]
    pub keep_time: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
pub enum NoteFilter {
    All,
    Folder(String),
    /// Notes that carry every one of these tags.
    Tags(Vec<String>),
    Trash,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NoteSort {
    Edited,
    Created,
    Title,
}
