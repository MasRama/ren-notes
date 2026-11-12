//! Keeps the window on the screen it opens on. GNOME does this for every
//! window; Windows opens a window larger than a small laptop screen as it
//! is, under the taskbar.

/// A rectangle in physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// Room left between a shrunk window and the edges of the work area.
const MARGIN: i32 = 16;

/// Where the window should be to fit in `area` (the monitor without its
/// taskbar), or `None` when it already fits. A window too large shrinks,
/// leaving a margin; one hanging off an edge moves back in.
pub fn fit(window: Rect, area: Rect) -> Option<Rect> {
    let width = if window.width > area.width {
        (area.width - 2 * MARGIN).max(1)
    } else {
        window.width
    };
    let height = if window.height > area.height {
        (area.height - 2 * MARGIN).max(1)
    } else {
        window.height
    };
    let shrunk = width != window.width || height != window.height;
    let place = |at: i32, size: i32, start: i32, room: i32| {
        if shrunk && size < room {
            start + (room - size) / 2
        } else {
            at.clamp(start, (start + room - size).max(start))
        }
    };
    let fitted = Rect {
        x: place(window.x, width, area.x, area.width),
        y: place(window.y, height, area.y, area.height),
        width,
        height,
    };
    (fitted != window).then_some(fitted)
}

/// Fits the window to its monitor's work area.
#[cfg(not(target_os = "linux"))]
pub fn apply(window: &tauri::WebviewWindow) {
    use tauri::{PhysicalPosition, PhysicalSize};

    let (Ok(Some(monitor)), Ok(at), Ok(size), Ok(inner)) = (
        window.current_monitor(),
        window.outer_position(),
        window.outer_size(),
        window.inner_size(),
    ) else {
        return;
    };
    let work = monitor.work_area();
    let area = Rect {
        x: work.position.x,
        y: work.position.y,
        width: work.size.width as i32,
        height: work.size.height as i32,
    };
    let now = Rect {
        x: at.x,
        y: at.y,
        width: size.width as i32,
        height: size.height as i32,
    };
    if let Some(to) = fit(now, area) {
        // set_size sizes the inside; the outside has the resize border too.
        let border_w = size.width.saturating_sub(inner.width);
        let border_h = size.height.saturating_sub(inner.height);
        let _ = window.set_size(PhysicalSize::new(
            (to.width as u32).saturating_sub(border_w),
            (to.height as u32).saturating_sub(border_h),
        ));
        let _ = window.set_position(PhysicalPosition::new(to.x, to.y));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const fn rect(x: i32, y: i32, width: i32, height: i32) -> Rect {
        Rect {
            x,
            y,
            width,
            height,
        }
    }

    /// A 1366x768 laptop with a 48px taskbar at the bottom.
    const LAPTOP: Rect = rect(0, 0, 1366, 720);

    #[test]
    fn leaves_a_window_that_fits() {
        assert_eq!(fit(rect(100, 50, 1180, 600), LAPTOP), None);
    }

    #[test]
    fn shrinks_a_window_taller_than_the_screen_and_centres_it() {
        assert_eq!(
            fit(rect(93, 4, 1180, 760), LAPTOP),
            Some(rect(93, 16, 1180, 688))
        );
    }

    #[test]
    fn shrinks_both_ways_on_a_small_screen() {
        assert_eq!(
            fit(rect(0, 0, 1180, 760), rect(0, 0, 1024, 720)),
            Some(rect(16, 16, 992, 688))
        );
    }

    #[test]
    fn brings_back_a_window_left_off_screen() {
        assert_eq!(
            fit(rect(1200, -30, 800, 500), LAPTOP),
            Some(rect(566, 0, 800, 500))
        );
    }

    #[test]
    fn works_on_a_second_monitor() {
        let right = rect(1920, 0, 1920, 1040);
        assert_eq!(fit(rect(2000, 100, 1180, 760), right), None);
        assert_eq!(
            fit(rect(3500, 100, 1180, 760), right),
            Some(rect(2660, 100, 1180, 760))
        );
    }
}
