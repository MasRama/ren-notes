//! The desktop's average colour, which the page mixes into the sidebar the
//! way the Mac tints windows with the wallpaper. GNOME only: elsewhere, or
//! when the wallpaper cannot be read, there is no tint.

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

#[cfg(not(target_os = "linux"))]
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

/// `#rgb` or `#rrggbb`, the forms GNOME stores colours in.
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
}
