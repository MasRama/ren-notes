/// The `#tags` in `text`, lowercased, each once, in order of first use.
///
/// A tag starts with `#` at the start of the text or after whitespace or an
/// opening bracket or quote, runs over letters, digits, `-` and `_`, and must
/// contain at least one letter. Trailing `-` and `_` are not part of it.
pub fn parse_tags(text: &str) -> Vec<String> {
    let mut tags: Vec<String> = Vec::new();
    let mut previous: Option<char> = None;
    let mut chars = text.char_indices().peekable();
    while let Some((start, c)) = chars.next() {
        let at_boundary = previous.is_none_or(|p| p.is_whitespace() || "([{\"'".contains(p));
        previous = Some(c);
        if c != '#' || !at_boundary {
            continue;
        }
        let body_start = start + c.len_utf8();
        let mut body_end = body_start;
        while let Some(&(index, next)) = chars.peek() {
            if !(next.is_alphanumeric() || next == '-' || next == '_') {
                break;
            }
            body_end = index + next.len_utf8();
            previous = Some(next);
            chars.next();
        }
        let body = text[body_start..body_end].trim_end_matches(['-', '_']);
        if body.chars().any(char::is_alphabetic) {
            let tag = body.to_lowercase();
            if !tags.contains(&tag) {
                tags.push(tag);
            }
        }
    }
    tags
}

#[cfg(test)]
mod tests {
    use super::parse_tags;

    #[test]
    fn same_tag_once_lowercased() {
        assert_eq!(parse_tags("Plan #Work and #work later"), ["work"]);
    }

    #[test]
    fn dashes_underscores_and_unicode() {
        assert_eq!(
            parse_tags("#ide-baru #to_do #ünïcode"),
            ["ide-baru", "to_do", "ünïcode"]
        );
    }

    #[test]
    fn hash_inside_words_and_bare_hashes_are_not_tags() {
        assert!(parse_tags("a#b x.com/#anchor ## #").is_empty());
    }

    #[test]
    fn a_tag_needs_a_letter() {
        assert_eq!(parse_tags("#123 #2026plan"), ["2026plan"]);
    }

    #[test]
    fn trailing_punctuation_is_not_part_of_the_tag() {
        assert_eq!(parse_tags("ends #work, and #home."), ["work", "home"]);
        assert_eq!(parse_tags("#draft- #wip_"), ["draft", "wip"]);
    }

    #[test]
    fn tags_after_brackets_and_quotes() {
        assert_eq!(parse_tags("(#paren) \"#quote\""), ["paren", "quote"]);
    }
}
