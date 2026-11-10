//! `#tags` written in a note's text.

mod list;
mod parse;

pub use list::{list, TagCount};
pub use parse::parse_tags;
