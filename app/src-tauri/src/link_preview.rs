//! What a link card shows: a page's title, its site and its picture, read
//! from the page's `<title>` and Open Graph tags.

use url::Url;

#[derive(Debug, Default, PartialEq)]
pub struct Meta {
    pub title: Option<String>,
    pub site: String,
    pub image: Option<Url>,
}

/// The most of a page read for its tags; they sit in its head.
const PAGE_MAX: usize = 1 << 20;
/// The largest picture a card keeps.
const IMAGE_MAX: usize = 5 << 20;
/// Seconds before a slow site is given up on.
const TIMEOUT: u32 = 8;

/// A card's fields with its picture's bytes, ready to store.
pub struct Preview {
    pub meta: Meta,
    /// The picture and the file extension its type has.
    pub image: Option<(Vec<u8>, &'static str)>,
}

/// Fetches the page and its picture. `None` when the page cannot be read or
/// is not HTML; a picture that cannot be fetched is left out.
pub fn preview(page: &Url) -> Option<Preview> {
    let (url, kind, body) = fetch(page, PAGE_MAX)?;
    if !kind.starts_with("text/html") && !kind.starts_with("application/xhtml") {
        return None;
    }
    let meta = parse(&String::from_utf8_lossy(&body), &url);
    let image = meta.image.as_ref().and_then(|src| {
        let (_, kind, bytes) = fetch(src, IMAGE_MAX)?;
        Some((bytes, image_ext(&kind)?))
    });
    Some(Preview { meta, image })
}

/// The extension for a picture type a card may show; nothing else (SVG
/// included) is kept.
pub fn image_ext(content_type: &str) -> Option<&'static str> {
    let kind = content_type.split(';').next()?.trim().to_ascii_lowercase();
    match kind.as_str() {
        "image/jpeg" | "image/jpg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/gif" => Some("gif"),
        "image/webp" => Some("webp"),
        _ => None,
    }
}

/// GETs `url` with libsoup (the HTTP stack WebKitGTK already brings),
/// returning the final URL after redirects, the content type and at most
/// `limit` bytes of the body. Successful responses only.
#[cfg(target_os = "linux")]
fn fetch(url: &Url, limit: usize) -> Option<(Url, String, Vec<u8>)> {
    use soup::gio::prelude::*;
    use soup::prelude::*;

    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    let session = soup::Session::new();
    session.set_timeout(TIMEOUT);
    session.set_user_agent("Mozilla/5.0 (X11; Linux x86_64) Renotes");
    let message = soup::Message::new("GET", url.as_str()).ok()?;
    let stream = session.send(&message, soup::gio::Cancellable::NONE).ok()?;
    if !(200..300).contains(&message.status_code()) {
        return None;
    }
    let kind = message
        .response_headers()
        .and_then(|h| h.one("Content-Type"))
        .map(|k| k.to_string())
        .unwrap_or_default();
    let mut body = Vec::new();
    let mut chunk = vec![0u8; 64 * 1024];
    while body.len() < limit {
        let read = stream.read(&mut chunk, soup::gio::Cancellable::NONE).ok()?;
        if read == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..read]);
    }
    let _ = stream.close(soup::gio::Cancellable::NONE);
    body.truncate(limit);
    let last = message
        .uri()
        .and_then(|u| Url::parse(&u.to_str()).ok())
        .unwrap_or_else(|| url.clone());
    Some((last, kind, body))
}

#[cfg(not(target_os = "linux"))]
fn fetch(_url: &Url, _limit: usize) -> Option<(Url, String, Vec<u8>)> {
    None
}

/// Longest title a card keeps, in characters.
const TITLE_MAX: usize = 300;

/// Reads the card's fields from a page's HTML.
pub fn parse(html: &str, page: &Url) -> Meta {
    // ASCII lowercasing keeps byte offsets, so positions found in `lower`
    // index `html` too.
    let lower = html.to_ascii_lowercase();
    let mut og_title = None;
    let mut og_site = None;
    let mut og_image = None;
    let mut from = 0;
    while let Some(at) = lower[from..].find("<meta") {
        let start = from + at + "<meta".len();
        let end = lower[start..].find('>').map_or(html.len(), |e| start + e);
        let attrs = attributes(&html[start..end]);
        let key = attrs
            .iter()
            .find(|(k, _)| k == "property" || k == "name")
            .map(|(_, v)| v.to_ascii_lowercase());
        let content = attrs.iter().find(|(k, _)| k == "content").map(|(_, v)| v);
        let content = content.filter(|c| !c.trim().is_empty());
        if let (Some(key), Some(content)) = (key, content) {
            let slot = match key.as_str() {
                "og:title" => &mut og_title,
                "og:site_name" => &mut og_site,
                "og:image" => &mut og_image,
                _ => &mut None,
            };
            slot.get_or_insert_with(|| content.clone());
        }
        from = end;
    }

    let title = og_title
        .map(|t| clean(&t))
        .filter(|t| !t.is_empty())
        .or_else(|| title_tag(html, &lower))
        .filter(|t| !t.is_empty());
    let site = og_site
        .map(|s| clean(&s))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| host(page));
    let image = og_image
        .and_then(|src| page.join(decode(src.trim()).as_str()).ok())
        .filter(|u| matches!(u.scheme(), "http" | "https"));
    Meta { title, site, image }
}

fn title_tag(html: &str, lower: &str) -> Option<String> {
    let open = lower.find("<title")?;
    let start = open + lower[open..].find('>')? + 1;
    let end = start + lower[start..].find("</title")?;
    Some(clean(&html[start..end]))
}

/// A page's host without its `www.`.
fn host(page: &Url) -> String {
    let host = page.host_str().unwrap_or_default();
    host.strip_prefix("www.").unwrap_or(host).to_owned()
}

/// `name=value` pairs of a tag, names lowercased, values quoted or bare.
fn attributes(tag: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut rest = tag.trim_start_matches(|c: char| c.is_whitespace() || c == '/');
    while !rest.is_empty() {
        let name_end = rest
            .find(|c: char| c == '=' || c.is_whitespace() || c == '/')
            .unwrap_or(rest.len());
        let name = rest[..name_end].to_ascii_lowercase();
        rest = rest[name_end..].trim_start();
        let mut value = String::new();
        if let Some(after) = rest.strip_prefix('=') {
            let after = after.trim_start();
            let (v, tail) = match after.chars().next() {
                Some(q @ ('"' | '\'')) => {
                    let body = &after[1..];
                    let close = body.find(q).unwrap_or(body.len());
                    (&body[..close], body.get(close + 1..).unwrap_or(""))
                }
                _ => {
                    let close = after.find(char::is_whitespace).unwrap_or(after.len());
                    (&after[..close], &after[close..])
                }
            };
            value = v.to_owned();
            rest = tail;
        }
        if !name.is_empty() {
            out.push((name, value));
        }
        rest = rest.trim_start_matches(|c: char| c.is_whitespace() || c == '/');
    }
    out
}

/// Entities decoded, whitespace collapsed, length capped.
fn clean(text: &str) -> String {
    let text = decode(text);
    let joined = text.split_whitespace().collect::<Vec<_>>().join(" ");
    joined.chars().take(TITLE_MAX).collect()
}

/// The entities pages put in titles: the named few and numeric ones.
fn decode(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(at) = rest.find('&') {
        out.push_str(&rest[..at]);
        rest = &rest[at..];
        let entity = rest[1..]
            .find(';')
            .filter(|&n| n <= 10)
            .map(|n| &rest[1..=n]);
        let decoded = entity.and_then(|e| match e {
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" => Some('\''),
            "nbsp" => Some(' '),
            _ => {
                let n = e.strip_prefix('#')?;
                let code = match n.strip_prefix(['x', 'X']) {
                    Some(hex) => u32::from_str_radix(hex, 16).ok()?,
                    None => n.parse().ok()?,
                };
                char::from_u32(code)
            }
        });
        match (entity, decoded) {
            (Some(e), Some(c)) => {
                out.push(c);
                rest = &rest[e.len() + 2..];
            }
            _ => {
                out.push('&');
                rest = &rest[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn page() -> Url {
        Url::parse("https://www.example.com/trips/lembang").unwrap()
    }

    #[test]
    fn reads_open_graph_tags() {
        let html = r#"<html><head><title>Plain</title>
            <meta property="og:title" content="Weekend in Lembang">
            <meta property="og:site_name" content="Example Travel">
            <meta property="og:image" content="/img/ridge.jpg"></head></html>"#;
        assert_eq!(
            parse(html, &page()),
            Meta {
                title: Some("Weekend in Lembang".into()),
                site: "Example Travel".into(),
                image: Some(Url::parse("https://www.example.com/img/ridge.jpg").unwrap()),
            }
        );
    }

    #[test]
    fn falls_back_to_the_title_and_host() {
        let html = "<head><TITLE>\n  Lembang   trip\n</TITLE></head>";
        let meta = parse(html, &page());
        assert_eq!(meta.title.as_deref(), Some("Lembang trip"));
        assert_eq!(meta.site, "example.com");
        assert_eq!(meta.image, None);
    }

    #[test]
    fn reads_attributes_in_any_order_and_quoting() {
        let html = "<meta content='Tom &amp; Jerry&#39;s &quot;Day&quot;' property='og:title'>";
        assert_eq!(
            parse(html, &page()).title.as_deref(),
            Some("Tom & Jerry's \"Day\"")
        );
    }

    #[test]
    fn takes_only_web_pictures() {
        let html = r#"<meta property="og:image" content="data:image/png;base64,AAAA">"#;
        assert_eq!(parse(html, &page()).image, None);
        let html = r#"<meta property="og:image" content="javascript:alert(1)">"#;
        assert_eq!(parse(html, &page()).image, None);
    }

    #[test]
    fn skips_empty_tags() {
        let html = r#"<meta property="og:title" content="">
            <meta property="og:site_name" content=" ">
            <title>Rust Programming Language</title>"#;
        let meta = parse(html, &page());
        assert_eq!(meta.title.as_deref(), Some("Rust Programming Language"));
        assert_eq!(meta.site, "example.com");
    }

    #[test]
    fn keeps_only_plain_picture_types() {
        assert_eq!(image_ext("image/jpeg"), Some("jpg"));
        assert_eq!(image_ext("IMAGE/PNG; charset=binary"), Some("png"));
        assert_eq!(image_ext("image/webp"), Some("webp"));
        assert_eq!(image_ext("image/svg+xml"), None);
        assert_eq!(image_ext("text/html"), None);
    }

    #[test]
    fn has_no_title_for_a_page_without_one() {
        let meta = parse("<p>hello</p>", &page());
        assert_eq!(meta.title, None);
        assert_eq!(meta.site, "example.com");
    }
}
