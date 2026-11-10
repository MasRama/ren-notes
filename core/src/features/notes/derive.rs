//! Limits on what the page derives from a document.

use super::model::SaveNote;

pub const TITLE_MAX: usize = 200;
pub const SNIPPET_MAX: usize = 300;

/// Makes title and snippet single lines, trimmed and capped in characters.
pub fn clamp(input: &mut SaveNote) {
    input.title = one_line(&input.title, TITLE_MAX);
    input.snippet = one_line(&input.snippet, SNIPPET_MAX);
}

fn one_line(text: &str, max: usize) -> String {
    let joined = text.split_whitespace().collect::<Vec<_>>().join(" ");
    joined.chars().take(max).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_makes_single_line_and_limits() {
        let mut input = SaveNote {
            title: "  a\nb ".into(),
            snippet: "x\r\ny".into(),
            ..Default::default()
        };
        clamp(&mut input);
        assert_eq!(input.title, "a b");
        assert_eq!(input.snippet, "x y");

        let mut long = SaveNote {
            title: "é".repeat(250),
            snippet: "s".repeat(400),
            ..Default::default()
        };
        clamp(&mut long);
        assert_eq!(long.title.chars().count(), TITLE_MAX);
        assert_eq!(TITLE_MAX, 200);
        assert_eq!(long.snippet.chars().count(), SNIPPET_MAX);
        assert_eq!(SNIPPET_MAX, 300);
    }
}
