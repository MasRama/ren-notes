//! Full-text search over every note's title and text.

use rusqlite::types::Value;

use crate::features::notes::{list_where, NoteSummary};
use crate::shared::db::Db;
use crate::shared::error::Result;

/// Notes whose title or text contain every word of `query` as a word prefix,
/// best matches first (a hit in the title weighs more). Deleted notes are
/// left out. The query is plain text: search syntax has no meaning in it.
pub fn search(db: &Db, query: &str) -> Result<Vec<NoteSummary>> {
    let Some(fts_query) = fts_query(query) else {
        return Ok(Vec::new());
    };
    list_where(
        db,
        "deleted_at IS NULL AND rowid IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?1)",
        &[Value::Text(fts_query.clone())],
        "(SELECT bm25(notes_fts, 10.0, 1.0) FROM notes_fts
          WHERE notes_fts MATCH ?1 AND notes_fts.rowid = notes.rowid), updated_at DESC",
    )
}

/// Each run of letters and digits becomes a quoted prefix term.
fn fts_query(query: &str) -> Option<String> {
    let terms: Vec<String> = query
        .split(|c: char| !c.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(|word| format!("\"{word}\"*"))
        .collect();
    (!terms.is_empty()).then(|| terms.join(" "))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::notes;
    use crate::shared::testing::{note_with_text, temp_db};

    fn titles(db: &Db, query: &str) -> Vec<String> {
        search(db, query)
            .unwrap()
            .into_iter()
            .map(|n| n.title)
            .collect()
    }

    #[test]
    fn prefix_words_all_must_match() {
        let mut t = temp_db();
        note_with_text(&mut t.db, "Groceries\nbuy milk and eggs");
        note_with_text(&mut t.db, "Milkshake recipe\nbanana");
        note_with_text(&mut t.db, "Work\nmeeting notes");
        let mut both = titles(&t.db, "milk");
        both.sort();
        assert_eq!(both, ["Groceries", "Milkshake recipe"]);
        assert_eq!(titles(&t.db, "milk egg"), ["Groceries"]);
        assert!(titles(&t.db, "nothing-like-this").is_empty());
    }

    #[test]
    fn title_hits_rank_first() {
        let mut t = temp_db();
        note_with_text(&mut t.db, "Shopping\nremember the plan for later");
        note_with_text(&mut t.db, "Plan\nfor the trip");
        assert_eq!(titles(&t.db, "plan")[0], "Plan");
    }

    #[test]
    fn diacritics_and_case_are_ignored() {
        let mut t = temp_db();
        note_with_text(&mut t.db, "Café list");
        assert_eq!(titles(&t.db, "CAFE"), ["Café list"]);
    }

    #[test]
    fn query_syntax_is_treated_as_text() {
        let mut t = temp_db();
        note_with_text(&mut t.db, "say \"hi\" (now) OR NOT * - :");
        assert_eq!(
            titles(&t.db, "\"hi\" (now"),
            ["say \"hi\" (now) OR NOT * - :"]
        );
        assert!(titles(&t.db, "   ").is_empty());
        assert!(titles(&t.db, "* : -").is_empty());
    }

    #[test]
    fn deleted_notes_are_not_found() {
        let mut t = temp_db();
        let id = note_with_text(&mut t.db, "secret plan");
        notes::delete(&mut t.db, &id).unwrap();
        assert!(titles(&t.db, "secret").is_empty());
    }
}
