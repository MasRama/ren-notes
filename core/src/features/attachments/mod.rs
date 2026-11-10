//! Pictures and files added to notes. Each is stored once, named by the
//! SHA-256 of its bytes; pictures get a small JPEG thumbnail for the list.

use std::io::Write;
use std::path::{Path, PathBuf};

use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::shared::db::Db;
use crate::shared::error::{Error, Result};

/// Longest side of a thumbnail, in pixels.
pub const THUMB_MAX: u32 = 512;
/// Unused attachments younger than this are kept: the note that will use
/// them may not be saved yet.
pub const GRACE_MS: i64 = 60 * 60 * 1000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub mime: String,
    pub file_name: String,
    pub byte_size: i64,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// Stores `bytes` under the library `root` (once per distinct content) and
/// records it. Pictures get their size and a thumbnail; a picture that does
/// not decode is kept as a plain file.
pub fn add(root: &Path, db: &mut Db, bytes: &[u8], file_name: &str) -> Result<Attachment> {
    if bytes.is_empty() {
        return Err(Error::InvalidInput("the file is empty".to_owned()));
    }
    let id = hex(&Sha256::digest(bytes));
    if let Some(existing) = get(db, &id)? {
        return Ok(existing);
    }
    let file_name = clean_file_name(file_name);
    let ext = extension(&file_name);
    let mut mime = mime_for(&ext).to_owned();
    if let Ok(format) = image::guess_format(bytes) {
        mime = format.to_mime_type().to_owned();
    }

    let mut size = None;
    if mime.starts_with("image/") && mime != "image/svg+xml" {
        if let Ok(picture) = image::load_from_memory(bytes) {
            size = Some((picture.width(), picture.height()));
            let thumb = picture.thumbnail(THUMB_MAX, THUMB_MAX).into_rgb8();
            let mut jpeg = Vec::new();
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 82)
                .encode_image(&thumb)
                .map_err(|e| Error::InvalidInput(e.to_string()))?;
            write_atomic(&thumb_path(root, &id), &jpeg)?;
        }
    }
    write_atomic(
        &root.join("attachments").join(stored_name(&id, &ext)),
        bytes,
    )?;

    let attachment = Attachment {
        id,
        mime,
        file_name,
        byte_size: bytes.len() as i64,
        width: size.map(|s| s.0),
        height: size.map(|s| s.1),
    };
    let now = db.now();
    db.conn().execute(
        "INSERT OR IGNORE INTO attachments (id, mime, file_name, byte_size, width, height, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            attachment.id,
            attachment.mime,
            attachment.file_name,
            attachment.byte_size,
            attachment.width,
            attachment.height,
            now
        ],
    )?;
    Ok(attachment)
}

pub fn get(db: &Db, id: &str) -> Result<Option<Attachment>> {
    Ok(db
        .conn()
        .query_row(
            "SELECT id, mime, file_name, byte_size, width, height FROM attachments WHERE id = ?1",
            [id],
            |r| {
                Ok(Attachment {
                    id: r.get(0)?,
                    mime: r.get(1)?,
                    file_name: r.get(2)?,
                    byte_size: r.get(3)?,
                    width: r.get(4)?,
                    height: r.get(5)?,
                })
            },
        )
        .optional()?)
}

/// Where an attachment's bytes are on disk.
pub fn file_path(root: &Path, db: &Db, id: &str) -> Result<PathBuf> {
    let attachment = get(db, id)?.ok_or(Error::NotFound("attachment"))?;
    let ext = extension(&attachment.file_name);
    Ok(root
        .join("attachments")
        .join(stored_name(&attachment.id, &ext)))
}

pub fn thumb_path(root: &Path, id: &str) -> PathBuf {
    root.join("thumbs").join(format!("{id}.jpg"))
}

/// Removes attachments no note uses any more (deleted notes included), once
/// they are older than the grace period. Returns how many.
pub fn collect_garbage(root: &Path, db: &mut Db) -> Result<usize> {
    let cutoff = db.now() - GRACE_MS;
    let unused: Vec<(String, String)> = db
        .conn()
        .prepare(
            "SELECT id, file_name FROM attachments
             WHERE created_at < ?1 AND id NOT IN (SELECT attachment_id FROM note_attachments)",
        )?
        .query_map([cutoff], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<std::result::Result<_, _>>()?;
    for (id, file_name) in &unused {
        let ext = extension(file_name);
        remove_if_present(&root.join("attachments").join(stored_name(id, &ext)))?;
        remove_if_present(&thumb_path(root, id))?;
        db.conn()
            .execute("DELETE FROM attachments WHERE id = ?1", [id])?;
    }
    Ok(unused.len())
}

fn remove_if_present(path: &Path) -> Result<()> {
    match std::fs::remove_file(path) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.into()),
        _ => Ok(()),
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// The file name without any directory part; "file" when nothing is left.
fn clean_file_name(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or("").trim();
    if base.is_empty() {
        "file".to_owned()
    } else {
        base.chars().take(200).collect()
    }
}

/// Lowercase extension of up to 8 letters or digits, or "bin".
fn extension(file_name: &str) -> String {
    file_name
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_lowercase())
        .filter(|ext| {
            !ext.is_empty() && ext.len() <= 8 && ext.chars().all(|c| c.is_ascii_alphanumeric())
        })
        .unwrap_or_else(|| "bin".to_owned())
}

fn stored_name(id: &str, ext: &str) -> String {
    format!("{id}.{ext}")
}

fn mime_for(ext: &str) -> &'static str {
    match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "csv" => "text/csv",
        "json" => "application/json",
        "zip" => "application/zip",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => "application/octet-stream",
    }
}

/// Writes through a temporary file in the same folder, then renames, so a
/// crash never leaves half a file under the final name.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let dir = path
        .parent()
        .ok_or(Error::InvalidInput("bad path".to_owned()))?;
    let tmp = dir.join(format!(
        ".{}.tmp",
        path.file_name().unwrap_or_default().to_string_lossy()
    ));
    let mut file = std::fs::File::create(&tmp)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::notes::{self, SaveNote};
    use crate::shared::testing::{note_with_text, temp_db, TestDb};

    fn png(width: u32, height: u32) -> Vec<u8> {
        let img = image::RgbImage::from_pixel(width, height, image::Rgb([200, 120, 40]));
        let mut out = std::io::Cursor::new(Vec::new());
        img.write_to(&mut out, image::ImageFormat::Png).unwrap();
        out.into_inner()
    }

    fn root(t: &TestDb) -> std::path::PathBuf {
        let root = t.dir().to_path_buf();
        std::fs::create_dir_all(root.join("attachments")).unwrap();
        std::fs::create_dir_all(root.join("thumbs")).unwrap();
        root
    }

    #[test]
    fn picture_is_stored_once_with_size_and_thumbnail() {
        let mut t = temp_db();
        let root = root(&t);
        let bytes = png(1200, 600);
        let first = add(&root, &mut t.db, &bytes, "photo.png").unwrap();
        let again = add(&root, &mut t.db, &bytes, "copy.png").unwrap();
        assert_eq!(first.id, again.id);
        assert_eq!(first.id.len(), 64);
        assert_eq!(first.mime, "image/png");
        assert_eq!((first.width, first.height), (Some(1200), Some(600)));
        assert_eq!(first.byte_size, bytes.len() as i64);
        assert_eq!(
            std::fs::read(file_path(&root, &t.db, &first.id).unwrap()).unwrap(),
            bytes
        );
        let thumb = image::open(thumb_path(&root, &first.id)).unwrap();
        assert_eq!((thumb.width(), thumb.height()), (THUMB_MAX, THUMB_MAX / 2));
    }

    #[test]
    fn other_files_keep_their_name_and_get_no_thumbnail() {
        let mut t = temp_db();
        let root = root(&t);
        let file = add(&root, &mut t.db, b"%PDF-1.4 hello", "Invoice March.pdf").unwrap();
        assert_eq!(file.mime, "application/pdf");
        assert_eq!(file.file_name, "Invoice March.pdf");
        assert_eq!(file.width, None);
        assert!(!thumb_path(&root, &file.id).exists());
        assert!(file_path(&root, &t.db, &file.id)
            .unwrap()
            .to_string_lossy()
            .ends_with(".pdf"));
    }

    #[test]
    fn broken_picture_is_kept_as_a_file() {
        let mut t = temp_db();
        let root = root(&t);
        let file = add(&root, &mut t.db, b"not really a png", "broken.png").unwrap();
        assert_eq!(file.width, None);
        assert!(!thumb_path(&root, &file.id).exists());
    }

    #[test]
    fn empty_file_refused() {
        let mut t = temp_db();
        let root = root(&t);
        assert!(add(&root, &mut t.db, b"", "x.txt").is_err());
    }

    #[test]
    fn garbage_is_only_old_and_unused() {
        let mut t = temp_db();
        let root = root(&t);
        let used = add(&root, &mut t.db, &png(4, 4), "a.png").unwrap();
        let unused = add(&root, &mut t.db, b"loose", "b.txt").unwrap();
        let note = note_with_text(&mut t.db, "pic");
        let input = SaveNote {
            attachment_ids: vec![used.id.clone()],
            plain_text: "pic".into(),
            ..Default::default()
        };
        notes::save(&mut t.db, &note, input).unwrap();

        assert_eq!(collect_garbage(&root, &mut t.db).unwrap(), 0);
        t.clock.advance(GRACE_MS + 1);
        let fresh = add(&root, &mut t.db, b"fresh", "c.txt").unwrap();
        assert_eq!(collect_garbage(&root, &mut t.db).unwrap(), 1);
        assert!(file_path(&root, &t.db, &unused.id).is_err());
        assert!(!root
            .join("attachments")
            .join(format!("{}.txt", unused.id))
            .exists());
        assert!(file_path(&root, &t.db, &used.id).is_ok());
        assert!(file_path(&root, &t.db, &fresh.id).is_ok());
    }
}
