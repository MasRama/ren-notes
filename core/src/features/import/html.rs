//! Plain text from the HTML a browser's contenteditable writes.

const BLOCKS: &[&str] = &[
    "div",
    "p",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "pre",
    "ul",
    "ol",
];

/// Lines of text: block elements and `<br>` become line breaks, other tags
/// are dropped, entities are decoded. At most one blank line in a row.
pub fn html_to_text(html: &str) -> String {
    let mut out = String::new();
    let mut rest = html;
    while let Some(start) = rest.find('<') {
        out.push_str(&decode_entities(&rest[..start]));
        let after = &rest[start + 1..];
        let Some(end) = after.find('>') else {
            out.push_str(&decode_entities(&rest[start..]));
            rest = "";
            break;
        };
        let tag = after[..end].trim();
        let closing = tag.starts_with('/');
        let name: String = tag
            .trim_start_matches('/')
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric())
            .collect::<String>()
            .to_ascii_lowercase();
        if name.is_empty() {
            // "1 < 2": not a tag at all.
            out.push('<');
            rest = after;
            continue;
        }
        let block = BLOCKS.contains(&name.as_str());
        // A block starts and ends on its own line; <br> always breaks.
        let starts_block = block && !closing && !out.is_empty();
        let ends_block = block && closing;
        if name == "br" || ((starts_block || ends_block) && !out.ends_with('\n')) {
            out.push('\n');
        }
        rest = &after[end + 1..];
    }
    out.push_str(&decode_entities(rest));

    let mut lines: Vec<&str> = Vec::new();
    for line in out.lines().map(str::trim_end) {
        if line.is_empty() && lines.last().is_some_and(|l| l.is_empty()) {
            continue;
        }
        lines.push(line);
    }
    lines.join("\n").trim_matches('\n').to_owned()
}

fn decode_entities(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(amp) = rest.find('&') {
        out.push_str(&rest[..amp]);
        let after = &rest[amp..];
        let decoded = after.find(';').filter(|&semi| semi <= 10).and_then(|semi| {
            let name = &after[1..semi];
            let ch = match name {
                "nbsp" => Some(' '),
                "amp" => Some('&'),
                "lt" => Some('<'),
                "gt" => Some('>'),
                "quot" => Some('"'),
                "apos" | "#39" => Some('\''),
                _ if name.starts_with("#x") || name.starts_with("#X") => {
                    u32::from_str_radix(&name[2..], 16)
                        .ok()
                        .and_then(char::from_u32)
                }
                _ if name.starts_with('#') => name[1..].parse().ok().and_then(char::from_u32),
                _ => None,
            };
            ch.map(|c| (c, semi))
        });
        match decoded {
            Some((c, semi)) => {
                out.push(c);
                rest = &after[semi + 1..];
            }
            None => {
                out.push('&');
                rest = &after[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use super::html_to_text;

    #[test]
    fn contenteditable_lines() {
        assert_eq!(
            html_to_text("first<div>second</div><div><br></div><div>fourth</div>"),
            "first\nsecond\n\nfourth"
        );
        assert_eq!(html_to_text("a<br>b<br/>c"), "a\nb\nc");
    }

    #[test]
    fn tags_stripped_entities_decoded() {
        assert_eq!(
            html_to_text(
                "<b>Bold</b> &amp; <i>it</i>&nbsp;&lt;x&gt; &quot;q&quot; &#39;s&#39; &#x41;&#66;"
            ),
            "Bold & it <x> \"q\" 's' AB"
        );
    }

    #[test]
    fn unknown_entities_and_stray_brackets_survive() {
        assert_eq!(html_to_text("a &bogus; b & c"), "a &bogus; b & c");
        assert_eq!(html_to_text("1 < 2"), "1 < 2");
    }
}
