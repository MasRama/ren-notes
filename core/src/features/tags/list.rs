use serde::Serialize;

use crate::shared::db::Db;
use crate::shared::error::Result;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TagCount {
    pub tag: String,
    pub count: i64,
}

/// Every tag in use, A to Z, with how many notes (outside the trash) carry it.
pub fn list(db: &Db) -> Result<Vec<TagCount>> {
    let tags = db
        .conn()
        .prepare(
            "SELECT t.tag, count(*) FROM note_tags t JOIN notes n ON n.id = t.note_id
             WHERE n.deleted_at IS NULL GROUP BY t.tag ORDER BY t.tag",
        )?
        .query_map([], |row| {
            Ok(TagCount {
                tag: row.get(0)?,
                count: row.get(1)?,
            })
        })?
        .collect::<std::result::Result<_, _>>()?;
    Ok(tags)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::notes;
    use crate::shared::testing::{note_with_text, temp_db};

    #[test]
    fn tags_with_counts_skip_trash() {
        let mut t = temp_db();
        note_with_text(&mut t.db, "#work #home");
        note_with_text(&mut t.db, "#work");
        let gone = note_with_text(&mut t.db, "#old #work");
        notes::delete(&mut t.db, &gone).unwrap();
        assert_eq!(
            list(&t.db).unwrap(),
            vec![
                TagCount {
                    tag: "home".into(),
                    count: 1
                },
                TagCount {
                    tag: "work".into(),
                    count: 2
                },
            ]
        );
    }
}
