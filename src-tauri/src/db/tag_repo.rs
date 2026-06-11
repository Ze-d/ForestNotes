use rusqlite::{params, Connection};
use uuid::Uuid;

/// Ensure a tag exists for a vault (by normalized_name). Returns the tag id.
pub fn ensure_tag(conn: &Connection, vault_id: &str, name: &str, normalized_name: &str) -> Result<String, String> {
    let existing = conn.query_row(
        "SELECT id FROM tags WHERE vault_id = ?1 AND normalized_name = ?2",
        params![vault_id, normalized_name],
        |row| row.get::<_, String>(0),
    );

    match existing {
        Ok(id) => Ok(id),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let id = Uuid::new_v4().to_string();
            let now = super::vault_repo::iso_now();
            conn.execute(
                "INSERT INTO tags (id, vault_id, name, normalized_name, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, vault_id, name, normalized_name, now],
            )
            .map_err(|e| format!("Failed to insert tag: {}", e))?;
            Ok(id)
        }
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Link a note to a tag (insert into note_tags). Ignores if already exists.
pub fn link_note_tag(conn: &Connection, note_id: &str, tag_id: &str, source: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO note_tags (note_id, tag_id, source) VALUES (?1, ?2, ?3)",
        params![note_id, tag_id, source],
    )
    .map_err(|e| format!("{}", e))?;
    Ok(())
}

/// Remove all tag links for a note (used when reindexing a note).
pub fn unlink_note_tags(conn: &Connection, note_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM note_tags WHERE note_id = ?1",
        params![note_id],
    )
    .map_err(|e| format!("{}", e))?;
    Ok(())
}

/// Get all tags for a vault.
#[derive(Debug, serde::Serialize)]
pub struct TagRecord {
    pub id: String,
    pub vault_id: String,
    pub name: String,
    pub normalized_name: String,
    pub note_count: i64,
}

pub fn get_tags_for_vault(conn: &Connection, vault_id: &str) -> Result<Vec<TagRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.vault_id, t.name, t.normalized_name,
                    (SELECT COUNT(*) FROM note_tags nt JOIN notes n ON nt.note_id = n.id
                     WHERE nt.tag_id = t.id AND n.deleted = 0) as note_count
             FROM tags t WHERE t.vault_id = ?1 ORDER BY t.normalized_name",
        )
        .map_err(|e| format!("{}", e))?;
    let rows = stmt
        .query_map(params![vault_id], |row| {
            Ok(TagRecord {
                id: row.get(0)?,
                vault_id: row.get(1)?,
                name: row.get(2)?,
                normalized_name: row.get(3)?,
                note_count: row.get(4)?,
            })
        })
        .map_err(|e| format!("{}", e))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("{}", e))
}

/// Clear all tags and note_tags for a vault (used for rebuild).
pub fn clear_vault_tags(conn: &Connection, vault_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM note_tags WHERE tag_id IN (SELECT id FROM tags WHERE vault_id = ?1)",
        params![vault_id],
    )
    .map_err(|e| format!("{}", e))?;
    conn.execute(
        "DELETE FROM tag_cooccurrence_cache WHERE vault_id = ?1",
        params![vault_id],
    )
    .map_err(|e| format!("{}", e))?;
    conn.execute(
        "DELETE FROM tag_stats_cache WHERE tag_id IN (SELECT id FROM tags WHERE vault_id = ?1)",
        params![vault_id],
    )
    .map_err(|e| format!("{}", e))?;
    conn.execute(
        "DELETE FROM tags WHERE vault_id = ?1",
        params![vault_id],
    )
    .map_err(|e| format!("{}", e))?;
    Ok(())
}
