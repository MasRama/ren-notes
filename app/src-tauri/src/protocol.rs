//! `renotes://localhost/attachment/<id>` and `/thumb/<id>`: attachment files
//! served to the page, which has no file system access of its own.

use std::path::PathBuf;

use renotes_core::app::Library;
use renotes_core::features::attachments;

/// A file to serve and its content type.
#[derive(Debug, PartialEq, Eq)]
pub struct Served {
    pub path: PathBuf,
    pub mime: String,
}

/// What a request path names, if anything. Ids are SHA-256 hex, so
/// anything else (`..`, slashes) is refused before touching the disk.
pub fn resolve(library: &Library, path: &str) -> Option<Served> {
    let (kind, id) = path.trim_start_matches('/').split_once('/')?;
    if id.len() != 64 || !id.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    match kind {
        "attachment" => {
            let found = attachments::get(library.db(), id).ok()??;
            let path = attachments::file_path(library.root(), library.db(), id).ok()?;
            Some(Served {
                path,
                mime: found.mime,
            })
        }
        "thumb" => {
            let path = attachments::thumb_path(library.root(), id);
            path.is_file().then(|| Served {
                path,
                mime: "image/jpeg".to_owned(),
            })
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn png() -> Vec<u8> {
        let img = test_picture();
        let mut out = Cursor::new(Vec::new());
        img.write_to(&mut out, image::ImageFormat::Png).unwrap();
        out.into_inner()
    }

    fn test_picture() -> image::RgbImage {
        image::RgbImage::from_pixel(8, 6, image::Rgb([200, 160, 0]))
    }

    #[test]
    fn serves_attachments_and_thumbs_by_id_only() {
        let dir = tempfile::tempdir().unwrap();
        let mut library = Library::open(dir.path()).unwrap();
        let root = library.root().to_owned();
        let pic = attachments::add(&root, library.db_mut(), &png(), "dot.png").unwrap();
        let file = attachments::add(&root, library.db_mut(), b"hello", "a.txt").unwrap();

        let served = resolve(&library, &format!("/attachment/{}", pic.id)).unwrap();
        assert_eq!(served.mime, "image/png");
        assert!(served.path.is_file());
        let thumb = resolve(&library, &format!("/thumb/{}", pic.id)).unwrap();
        assert_eq!(thumb.mime, "image/jpeg");
        assert!(resolve(&library, &format!("/thumb/{}", file.id)).is_none());

        assert!(resolve(&library, "/attachment/../../library.sqlite").is_none());
        assert!(resolve(&library, &format!("/other/{}", pic.id)).is_none());
        assert!(resolve(&library, &format!("/attachment/{}", "0".repeat(64))).is_none());
    }
}
