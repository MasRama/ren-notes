//! Where the library lives.

use std::path::PathBuf;

/// The folder's name under Linux's data home.
const DIR_NAME: &str = "ren-notes";
/// The folder's name under Windows' roaming app data, named as apps there are.
const WINDOWS_DIR_NAME: &str = "Renotes";

/// `$XDG_DATA_HOME/ren-notes`, or `~/.local/share/ren-notes` without it.
#[cfg(not(windows))]
pub fn data_dir() -> PathBuf {
    let xdg = std::env::var("XDG_DATA_HOME").ok();
    let home = std::env::var("HOME").unwrap_or_default();
    data_dir_from(xdg.as_deref(), &home)
}

/// `%APPDATA%\Renotes`, or under the user's profile when it is unset.
#[cfg(windows)]
pub fn data_dir() -> PathBuf {
    let appdata = std::env::var("APPDATA").ok();
    let profile = std::env::var("USERPROFILE").unwrap_or_default();
    windows_data_dir_from(appdata.as_deref(), &profile)
}

/// An empty `XDG_DATA_HOME` counts as unset, as the XDG base directory rules say.
pub fn data_dir_from(xdg_data_home: Option<&str>, home: &str) -> PathBuf {
    match xdg_data_home.filter(|x| !x.is_empty()) {
        Some(xdg) => PathBuf::from(xdg).join(DIR_NAME),
        None => PathBuf::from(home).join(".local/share").join(DIR_NAME),
    }
}

/// An empty `APPDATA` counts as unset; the profile's `AppData\Roaming` is
/// where it points by default.
pub fn windows_data_dir_from(appdata: Option<&str>, profile: &str) -> PathBuf {
    match appdata.filter(|a| !a.is_empty()) {
        Some(appdata) => PathBuf::from(appdata).join(WINDOWS_DIR_NAME),
        None => PathBuf::from(profile)
            .join("AppData")
            .join("Roaming")
            .join(WINDOWS_DIR_NAME),
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

    #[test]
    fn windows_keeps_the_library_in_roaming_app_data() {
        assert_eq!(
            windows_data_dir_from(Some("C:/Users/ren/AppData/Roaming"), "C:/Users/ren"),
            Path::new("C:/Users/ren/AppData/Roaming").join("Renotes")
        );
        let fallback = Path::new("C:/Users/ren")
            .join("AppData")
            .join("Roaming")
            .join("Renotes");
        assert_eq!(windows_data_dir_from(None, "C:/Users/ren"), fallback);
        assert_eq!(windows_data_dir_from(Some(""), "C:/Users/ren"), fallback);
    }
}
