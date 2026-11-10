//! Where the library lives.

use std::path::PathBuf;

const DIR_NAME: &str = "ren-notes";

/// `$XDG_DATA_HOME/ren-notes`, or `~/.local/share/ren-notes` without it.
pub fn data_dir() -> PathBuf {
    let xdg = std::env::var("XDG_DATA_HOME").ok();
    let home = std::env::var("HOME").unwrap_or_default();
    data_dir_from(xdg.as_deref(), &home)
}

/// An empty `XDG_DATA_HOME` counts as unset, as the XDG base directory rules say.
pub fn data_dir_from(xdg_data_home: Option<&str>, home: &str) -> PathBuf {
    match xdg_data_home.filter(|x| !x.is_empty()) {
        Some(xdg) => PathBuf::from(xdg).join(DIR_NAME),
        None => PathBuf::from(home).join(".local/share").join(DIR_NAME),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn paths_honour_xdg_data_home() {
        assert_eq!(data_dir_from(Some("/x"), "/h"), Path::new("/x/ren-notes"));
        assert_eq!(
            data_dir_from(None, "/h"),
            Path::new("/h/.local/share/ren-notes")
        );
        assert_eq!(
            data_dir_from(Some(""), "/h"),
            Path::new("/h/.local/share/ren-notes")
        );
    }
}
