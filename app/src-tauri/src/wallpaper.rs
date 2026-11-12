//! The desktop's average colour, which the page mixes into the sidebar the
//! way the Mac tints windows with the wallpaper. Read from GNOME's settings
//! on Linux and from the desktop settings on Windows; when the wallpaper
//! cannot be read, there is no tint.

/// The average colour of the current GNOME wallpaper as `#rrggbb`.
#[cfg(target_os = "linux")]
pub fn tint() -> Option<String> {
    use gtk::gio::{self, prelude::*};

    let background = settings("org.gnome.desktop.background")?;
    let dark = settings("org.gnome.desktop.interface")
        .is_some_and(|s| s.string("color-scheme") == "prefer-dark");
    let key = if dark {
        "picture-uri-dark"
    } else {
        "picture-uri"
    };
    let uri = background.string(key);
    let rgb = if uri.is_empty() || background.string("picture-options") == "none" {
        parse_hex(&background.string("primary-color"))?
    } else {
        let path = gio::File::for_uri(&uri).path()?;
        // Small is enough for an average, and quick to decode.
        let pixbuf = gtk::gdk_pixbuf::Pixbuf::from_file_at_scale(path, 32, 32, false).ok()?;
        let bytes = pixbuf.read_pixel_bytes();
        average(
            &bytes,
            pixbuf.width() as usize,
            pixbuf.height() as usize,
            pixbuf.rowstride() as usize,
            pixbuf.n_channels() as usize,
        )?
    };
    Some(format!("#{:02x}{:02x}{:02x}", rgb[0], rgb[1], rgb[2]))
}

/// The average colour of the Windows wallpaper as `#rrggbb`, or the desktop's
/// solid colour when there is no picture.
#[cfg(windows)]
pub fn tint() -> Option<String> {
    use std::sync::Mutex;
    use std::time::SystemTime;

    /// The last picture read, by path and change time: the page asks each
    /// time the window comes to the front, and a 4K picture takes a while.
    static LAST: Mutex<Option<(std::path::PathBuf, SystemTime, [u8; 3])>> = Mutex::new(None);

    let rgb = match windows_desktop::wallpaper_path() {
        Some(path) => {
            let changed = std::fs::metadata(&path).and_then(|m| m.modified()).ok()?;
            let mut last = LAST.lock().unwrap_or_else(|e| e.into_inner());
            match last.as_ref() {
                Some((p, t, rgb)) if *p == path && *t == changed => *rgb,
                _ => {
                    let small = image::open(&path).ok()?.thumbnail(32, 32).to_rgb8();
                    let (w, h) = small.dimensions();
                    let rgb = average(small.as_raw(), w as usize, h as usize, w as usize * 3, 3)?;
                    *last = Some((path, changed, rgb));
                    rgb
                }
            }
        }
        None => parse_rgb_triplet(&windows_desktop::background_colour()?)?,
    };
    Some(format!("#{:02x}{:02x}{:02x}", rgb[0], rgb[1], rgb[2]))
}

#[cfg(windows)]
mod windows_desktop {
    use std::ffi::OsString;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use std::path::PathBuf;

    use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SystemParametersInfoW, SPI_GETDESKWALLPAPER,
    };

    /// The picture on the desktop; `None` for a solid colour.
    pub fn wallpaper_path() -> Option<PathBuf> {
        let mut buf = [0u16; 1024];
        // SAFETY: the buffer is as long as we say it is.
        let ok = unsafe {
            SystemParametersInfoW(
                SPI_GETDESKWALLPAPER,
                buf.len() as u32,
                buf.as_mut_ptr().cast(),
                0,
            )
        };
        let path = PathBuf::from(from_wide(&buf));
        (ok != 0 && path.is_file()).then_some(path)
    }

    /// The desktop's solid colour as Windows keeps it: "R G B".
    pub fn background_colour() -> Option<String> {
        let key = wide("Control Panel\\Colors");
        let value = wide("Background");
        let mut buf = [0u16; 64];
        let mut size = (buf.len() * 2) as u32;
        // SAFETY: both names end in a NUL, and size is the buffer's in bytes.
        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                key.as_ptr(),
                value.as_ptr(),
                RRF_RT_REG_SZ,
                std::ptr::null_mut(),
                buf.as_mut_ptr().cast(),
                &mut size,
            )
        };
        (status == 0).then(|| from_wide(&buf))
    }

    fn wide(text: &str) -> Vec<u16> {
        std::ffi::OsStr::new(text)
            .encode_wide()
            .chain([0])
            .collect()
    }

    fn from_wide(buf: &[u16]) -> String {
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        OsString::from_wide(&buf[..end])
            .to_string_lossy()
            .into_owned()
    }
}

#[cfg(not(any(target_os = "linux", windows)))]
pub fn tint() -> Option<String> {
    None
}

/// GSettings aborts on a schema that is not installed, so look first.
#[cfg(target_os = "linux")]
fn settings(schema: &str) -> Option<gtk::gio::Settings> {
    let source = gtk::gio::SettingsSchemaSource::default()?;
    source.lookup(schema, true)?;
    Some(gtk::gio::Settings::new(schema))
}

/// The mean colour of packed RGB(A) rows, ignoring padding past each row.
#[cfg_attr(not(any(target_os = "linux", windows)), allow(dead_code))]
fn average(
    pixels: &[u8],
    width: usize,
    height: usize,
    rowstride: usize,
    channels: usize,
) -> Option<[u8; 3]> {
    if width == 0 || height == 0 || channels < 3 {
        return None;
    }
    let mut sum = [0u64; 3];
    for y in 0..height {
        for x in 0..width {
            let at = y * rowstride + x * channels;
            let px = pixels.get(at..at + 3)?;
            for (s, &p) in sum.iter_mut().zip(px) {
                *s += u64::from(p);
            }
        }
    }
    let n = (width * height) as u64;
    Some(sum.map(|s| (s / n) as u8))
}

/// "R G B" in decimal, the form Windows keeps the desktop colour in.
#[cfg_attr(not(windows), allow(dead_code))]
fn parse_rgb_triplet(text: &str) -> Option<[u8; 3]> {
    let mut parts = text.split_whitespace().map(|p| p.parse::<u8>().ok());
    let rgb = [parts.next()??, parts.next()??, parts.next()??];
    parts.next().is_none().then_some(rgb)
}

/// `#rgb` or `#rrggbb`, the forms GNOME stores colours in.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
fn parse_hex(text: &str) -> Option<[u8; 3]> {
    let hex = text.strip_prefix('#')?;
    let digit = |i: usize, len: usize| u8::from_str_radix(hex.get(i..i + len)?, 16).ok();
    match hex.len() {
        6 => Some([digit(0, 2)?, digit(2, 2)?, digit(4, 2)?]),
        3 => Some([digit(0, 1)? * 17, digit(1, 1)? * 17, digit(2, 1)? * 17]),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn averages_rgb_pixels() {
        let pixels = [255, 0, 0, 0, 0, 255];
        assert_eq!(average(&pixels, 2, 1, 6, 3), Some([127, 0, 127]));
    }

    #[test]
    fn skips_alpha_and_row_padding() {
        // Two rows of one RGBA pixel, each row padded to 8 bytes.
        let pixels = [10, 20, 30, 255, 9, 9, 9, 9, 30, 40, 50, 0, 9, 9, 9, 9];
        assert_eq!(average(&pixels, 1, 2, 8, 4), Some([20, 30, 40]));
    }

    #[test]
    fn has_no_average_without_pixels() {
        assert_eq!(average(&[], 0, 0, 0, 3), None);
        assert_eq!(average(&[1, 2], 1, 1, 3, 3), None);
    }

    #[test]
    fn reads_gnome_colours() {
        assert_eq!(parse_hex("#023c88"), Some([2, 60, 136]));
        assert_eq!(parse_hex("#fa0"), Some([255, 170, 0]));
        assert_eq!(parse_hex("023c88"), None);
        assert_eq!(parse_hex("#02zz88"), None);
    }

    #[test]
    fn reads_windows_colours() {
        assert_eq!(parse_rgb_triplet("58 110 165"), Some([58, 110, 165]));
        assert_eq!(parse_rgb_triplet(" 0  0 0 "), Some([0, 0, 0]));
        assert_eq!(parse_rgb_triplet("58 110"), None);
        assert_eq!(parse_rgb_triplet("58 110 165 9"), None);
        assert_eq!(parse_rgb_triplet("58 110 300"), None);
    }
}
