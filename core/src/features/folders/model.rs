use serde::Serialize;

/// The built-in folder. It cannot be renamed away or deleted.
pub const DEFAULT_FOLDER_ID: &str = "notes";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub sort_index: i64,
    /// Notes in this folder itself (not subfolders), trash excluded.
    pub note_count: i64,
    pub is_default: bool,
}
