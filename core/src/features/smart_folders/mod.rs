//! Smart folders: saved filters over every note, such as "tagged #work and
//! edited this week".

use rusqlite::types::Value;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::features::notes::{list_where, order_for, NoteSort, NoteSummary};
use crate::shared::db::Db;
use crate::shared::error::{Error, Result};
use crate::shared::ids::new_id;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TagMatch {
    #[default]
    Any,
    All,
}

/// What a note must have to show in a smart folder. Every rule that is set
/// must hold; an unset rule (empty, `None`, `false`) does not filter.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Rules {
    pub tags: Vec<String>,
    pub tag_match: TagMatch,
    pub edited_within_days: Option<u32>,
    pub created_within_days: Option<u32>,
    pub has_checklist: bool,
    pub has_attachment: bool,
    pub pinned: bool,
}

impl Rules {
    fn normalized(mut self) -> Rules {
        self.tags = self
            .tags
            .iter()
            .map(|t| t.trim().trim_start_matches('#').to_lowercase())
            .collect();
        self.tags.retain(|t| !t.is_empty());
        self.tags.sort();
        self.tags.dedup();
        self
    }

    fn is_empty(&self) -> bool {
        self.tags.is_empty()
            && self.edited_within_days.is_none()
            && self.created_within_days.is_none()
            && !self.has_checklist
            && !self.has_attachment
            && !self.pinned
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartFolder {
    pub id: String,
    pub name: String,
    pub rules: Rules,
    pub sort_index: i64,
}

pub fn list(db: &Db) -> Result<Vec<SmartFolder>> {
    let rows: Vec<(String, String, String, i64)> = db
        .conn()
        .prepare(
            "SELECT id, name, rules_json, sort_index FROM smart_folders ORDER BY sort_index, name",
        )?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?
        .collect::<std::result::Result<_, _>>()?;
    rows.into_iter()
        .map(|(id, name, rules, sort_index)| {
            Ok(SmartFolder {
                id,
                name,
                rules: serde_json::from_str(&rules)?,
                sort_index,
            })
        })
        .collect()
}

pub fn create(db: &mut Db, name: &str, rules: Rules) -> Result<SmartFolder> {
    let (name, rules) = validate(name, rules)?;
    let id = new_id();
    let sort_index: i64 = db.conn().query_row(
        "SELECT coalesce(max(sort_index), 0) + 1 FROM smart_folders",
        [],
        |r| r.get(0),
    )?;
    db.conn().execute(
        "INSERT INTO smart_folders (id, name, rules_json, sort_index) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, serde_json::to_string(&rules)?, sort_index],
    )?;
    Ok(SmartFolder {
        id,
        name,
        rules,
        sort_index,
    })
}

pub fn update(db: &mut Db, id: &str, name: &str, rules: Rules) -> Result<()> {
    let (name, rules) = validate(name, rules)?;
    let changed = db.conn().execute(
        "UPDATE smart_folders SET name = ?2, rules_json = ?3 WHERE id = ?1",
        params![id, name, serde_json::to_string(&rules)?],
    )?;
    if changed == 0 {
        return Err(Error::NotFound("smart folder"));
    }
    Ok(())
}

pub fn delete(db: &mut Db, id: &str) -> Result<()> {
    if db
        .conn()
        .execute("DELETE FROM smart_folders WHERE id = ?1", [id])?
        == 0
    {
        return Err(Error::NotFound("smart folder"));
    }
    Ok(())
}

/// The notes a smart folder shows, outside the trash.
pub fn list_notes(db: &Db, id: &str, sort: NoteSort) -> Result<Vec<NoteSummary>> {
    let rules_json: String = db
        .conn()
        .query_row(
            "SELECT rules_json FROM smart_folders WHERE id = ?1",
            [id],
            |r| r.get(0),
        )
        .optional()?
        .ok_or(Error::NotFound("smart folder"))?;
    let rules: Rules = serde_json::from_str(&rules_json)?;
    let mut conditions = vec!["deleted_at IS NULL".to_owned()];
    let mut args: Vec<Value> = Vec::new();
    if !rules.tags.is_empty() {
        let marks = vec!["?"; rules.tags.len()].join(", ");
        let having = match rules.tag_match {
            TagMatch::Any => String::new(),
            TagMatch::All => format!(
                " GROUP BY note_id HAVING count(DISTINCT tag) = {}",
                rules.tags.len()
            ),
        };
        conditions.push(format!(
            "id IN (SELECT note_id FROM note_tags WHERE tag IN ({marks}){having})"
        ));
        args.extend(rules.tags.iter().cloned().map(Value::Text));
    }
    let now = db.now();
    for (column, days) in [
        ("updated_at", rules.edited_within_days),
        ("created_at", rules.created_within_days),
    ] {
        if let Some(days) = days {
            conditions.push(format!("{column} >= ?"));
            args.push(Value::Integer(
                now - i64::from(days) * crate::features::trash::DAY_MS,
            ));
        }
    }
    for (column, wanted) in [
        ("has_checklist", rules.has_checklist),
        ("has_attachment", rules.has_attachment),
        ("pinned", rules.pinned),
    ] {
        if wanted {
            conditions.push(format!("{column} = 1"));
        }
    }
    list_where(db, &conditions.join(" AND "), &args, order_for(sort))
}

fn validate(name: &str, rules: Rules) -> Result<(String, Rules)> {
    let name = name.trim();
    if name.is_empty() {
        return Err(Error::InvalidInput(
            "a smart folder needs a name".to_owned(),
        ));
    }
    let rules = rules.normalized();
    if rules.is_empty() {
        return Err(Error::InvalidInput(
            "a smart folder needs at least one rule".to_owned(),
        ));
    }
    Ok((name.to_owned(), rules))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::notes::{self, NoteSort};
    use crate::shared::error::Error;
    use crate::shared::testing::{note_with_text, temp_db, TestDb};

    fn titles(t: &TestDb, id: &str) -> Vec<String> {
        let mut found: Vec<String> = list_notes(&t.db, id, NoteSort::Edited)
            .unwrap()
            .into_iter()
            .map(|n| n.title)
            .collect();
        found.sort();
        found
    }

    fn rules() -> Rules {
        Rules::default()
    }

    #[test]
    fn create_needs_a_name_and_a_rule() {
        let mut t = temp_db();
        assert!(matches!(
            create(
                &mut t.db,
                " ",
                Rules {
                    pinned: true,
                    ..rules()
                }
            ),
            Err(Error::InvalidInput(_))
        ));
        assert!(matches!(
            create(&mut t.db, "All", rules()),
            Err(Error::InvalidInput(_))
        ));
        let folder = create(
            &mut t.db,
            " Work ",
            Rules {
                tags: vec!["Work".into()],
                ..rules()
            },
        )
        .unwrap();
        assert_eq!(folder.name, "Work");
        assert_eq!(folder.rules.tags, ["work"]);
        assert_eq!(list(&t.db).unwrap(), vec![folder]);
    }

    #[test]
    fn tags_any_or_all() {
        let mut t = temp_db();
        note_with_text(&mut t.db, "A #x #y");
        note_with_text(&mut t.db, "B #x");
        note_with_text(&mut t.db, "C #z");
        let any = create(
            &mut t.db,
            "any",
            Rules {
                tags: vec!["x".into(), "y".into()],
                ..rules()
            },
        )
        .unwrap();
        let all = create(
            &mut t.db,
            "all",
            Rules {
                tags: vec!["x".into(), "y".into()],
                tag_match: TagMatch::All,
                ..rules()
            },
        )
        .unwrap();
        assert_eq!(titles(&t, &any.id), ["A #x #y", "B #x"]);
        assert_eq!(titles(&t, &all.id), ["A #x #y"]);
    }

    #[test]
    fn edited_within_days_and_flags() {
        let mut t = temp_db();
        let old = note_with_text(&mut t.db, "old");
        t.clock.advance(10 * crate::features::trash::DAY_MS);
        note_with_text(&mut t.db, "new");
        notes::set_pinned(&mut t.db, &old, true).unwrap();
        let recent = create(
            &mut t.db,
            "recent",
            Rules {
                edited_within_days: Some(7),
                ..rules()
            },
        )
        .unwrap();
        let pinned = create(
            &mut t.db,
            "pinned",
            Rules {
                pinned: true,
                ..rules()
            },
        )
        .unwrap();
        let both = create(
            &mut t.db,
            "both",
            Rules {
                pinned: true,
                edited_within_days: Some(7),
                ..rules()
            },
        )
        .unwrap();
        assert_eq!(titles(&t, &recent.id), ["new"]);
        assert_eq!(titles(&t, &pinned.id), ["old"]);
        assert!(titles(&t, &both.id).is_empty());
    }

    #[test]
    fn update_and_delete() {
        let mut t = temp_db();
        let folder = create(
            &mut t.db,
            "P",
            Rules {
                pinned: true,
                ..rules()
            },
        )
        .unwrap();
        update(
            &mut t.db,
            &folder.id,
            "Checklists",
            Rules {
                has_checklist: true,
                ..rules()
            },
        )
        .unwrap();
        let listed = &list(&t.db).unwrap()[0];
        assert_eq!(listed.name, "Checklists");
        assert!(listed.rules.has_checklist && !listed.rules.pinned);
        delete(&mut t.db, &folder.id).unwrap();
        assert!(list(&t.db).unwrap().is_empty());
        assert!(matches!(
            list_notes(&t.db, &folder.id, NoteSort::Edited),
            Err(Error::NotFound(_))
        ));
    }
}
