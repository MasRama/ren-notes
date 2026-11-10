//! The window's size across starts, kept in the library's session table.
//!
//! The window-state plugin cannot keep it on Linux: with GTK drawing the
//! frame, tao reports the size with the shadow around it but restores it
//! without, so the window grew by the shadow on every start.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// The session key the size is kept under.
pub const KEY: &str = "window";

/// The smallest window, as in tauri.conf.json.
const MIN: (i32, i32) = (720, 480);
/// Anything larger is not a size a window was ever given.
const MAX: i32 = 16_384;

#[derive(Debug, Serialize, Deserialize)]
struct Saved {
    width: i32,
    height: i32,
}

/// The size to open at, from what was saved, or `None` to keep the default.
pub fn restored(saved: Option<Value>) -> Option<(i32, i32)> {
    let saved: Saved = serde_json::from_value(saved?).ok()?;
    if saved.width <= 0 || saved.height <= 0 || saved.width > MAX || saved.height > MAX {
        return None;
    }
    Some((saved.width.max(MIN.0), saved.height.max(MIN.1)))
}

/// What to save for a window of this size.
pub fn to_saved(width: i32, height: i32) -> Value {
    serde_json::to_value(Saved { width, height }).expect("plain numbers")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reopens_at_the_saved_size() {
        assert_eq!(restored(Some(to_saved(1180, 760))), Some((1180, 760)));
    }

    #[test]
    fn keeps_the_default_without_a_saved_size() {
        assert_eq!(restored(None), None);
        assert_eq!(restored(Some(json!({ "width": "wide" }))), None);
    }

    #[test]
    fn never_opens_smaller_than_the_minimum() {
        assert_eq!(restored(Some(to_saved(300, 200))), Some((720, 480)));
    }

    #[test]
    fn ignores_sizes_no_window_had() {
        assert_eq!(restored(Some(to_saved(0, 760))), None);
        assert_eq!(restored(Some(to_saved(1180, 99_999))), None);
    }
}
