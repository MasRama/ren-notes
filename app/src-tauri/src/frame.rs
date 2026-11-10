//! The window frame on Linux. GTK draws its client-side decorations around
//! an empty title bar: the shadow, the resize edges and the window's real
//! outline (so GNOME snaps and tiles it right), while the page draws
//! everything inside, rounded to match.

use gtk::gdk::WindowState;
use gtk::prelude::*;
use tauri::WebviewWindow;

/// Applied to Renotes' own windows only (the `renotes-frame` class).
const CSS: &str = "
window.renotes-frame {
  background-color: transparent;
}
window.renotes-frame .titlebar {
  min-height: 0;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  box-shadow: none;
}
window.renotes-frame decoration {
  border-radius: 10px;
  border: none;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.14),
    0 2px 6px rgba(0, 0, 0, 0.16),
    0 18px 46px rgba(0, 0, 0, 0.32);
}
window.renotes-frame decoration:backdrop {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.1),
    0 2px 5px rgba(0, 0, 0, 0.1),
    0 10px 28px rgba(0, 0, 0, 0.16);
}
window.renotes-frame.maximized decoration,
window.renotes-frame.fullscreen decoration,
window.renotes-frame.tiled decoration,
window.renotes-frame.tiled-top decoration,
window.renotes-frame.tiled-bottom decoration,
window.renotes-frame.tiled-left decoration,
window.renotes-frame.tiled-right decoration {
  border-radius: 0;
  box-shadow: none;
}
";

/// Turns GTK's decorations back on, with an empty title bar.
pub fn apply(window: &WebviewWindow) {
    let Ok(gtk_window) = window.gtk_window() else {
        return;
    };
    let provider = gtk::CssProvider::new();
    if provider.load_from_data(CSS.as_bytes()).is_err() {
        return;
    }
    if let Some(screen) = gtk::prelude::WidgetExt::screen(&gtk_window) {
        gtk::StyleContext::add_provider_for_screen(
            &screen,
            &provider,
            gtk::STYLE_PROVIDER_PRIORITY_APPLICATION,
        );
    }
    gtk_window.style_context().add_class("renotes-frame");
    gtk_window.set_titlebar(Some(&gtk::EventBox::new()));
    gtk_window.set_decorated(true);
}

/// The window's size without the frame's shadow, while it is a normal
/// window (not maximized, tiled or full screen).
pub fn size(window: &WebviewWindow) -> Option<(i32, i32)> {
    let gtk_window = window.gtk_window().ok()?;
    let state = gtk_window.window()?.state();
    if state.intersects(WindowState::MAXIMIZED | WindowState::FULLSCREEN | WindowState::TILED) {
        return None;
    }
    Some(gtk_window.size())
}

/// Sizes the window without its shadow; a maximized window gets this size
/// back when it is restored.
pub fn resize(window: &WebviewWindow, width: i32, height: i32) {
    if let Ok(gtk_window) = window.gtk_window() {
        gtk_window.resize(width, height);
    }
}
