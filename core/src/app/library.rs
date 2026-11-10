use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::shared::clock::{Clock, SystemClock};
use crate::shared::db::Db;
use crate::shared::error::Result;

/// The user's library on disk: the database plus the folders for
/// attachments and their thumbnails.
pub struct Library {
    db: Db,
    root: PathBuf,
}

impl Library {
    pub fn open(root: &Path) -> Result<Library> {
        Self::open_with_clock(root, Arc::new(SystemClock))
    }

    pub fn open_with_clock(root: &Path, clock: Arc<dyn Clock>) -> Result<Library> {
        std::fs::create_dir_all(root.join("attachments"))?;
        std::fs::create_dir_all(root.join("thumbs"))?;
        let db = Db::open(&root.join("library.sqlite"), clock)?;
        Ok(Library {
            db,
            root: root.to_owned(),
        })
    }

    pub fn db(&self) -> &Db {
        &self.db
    }

    pub fn db_mut(&mut self) -> &mut Db {
        &mut self.db
    }

    pub fn root(&self) -> &Path {
        &self.root
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::folders;

    #[test]
    fn library_open_creates_layout() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("ren-notes");
        let library = Library::open(&root).unwrap();
        assert!(root.join("library.sqlite").is_file());
        assert!(root.join("attachments").is_dir());
        assert!(root.join("thumbs").is_dir());
        assert_eq!(library.root(), root);
        assert_eq!(
            folders::list(library.db()).unwrap()[0].id,
            folders::DEFAULT_FOLDER_ID
        );
    }
}
