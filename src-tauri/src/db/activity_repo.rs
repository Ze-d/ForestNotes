use rusqlite::{params, Connection};
use uuid::Uuid;

#[derive(Debug, serde::Serialize)]
pub struct ActivityRecord {
    pub id: String,
    pub note_id: String,
    pub r#type: String,
    pub created_at: String,
}

/// Insert an activity record.
pub fn insert_activity(
    conn: &Connection,
    note_id: &str,
    activity_type: &str,
    metadata: Option<&str>,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = super::vault_repo::iso_now();
    conn.execute(
        "INSERT INTO note_activity (id, note_id, type, created_at, metadata_json) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, note_id, activity_type, now, metadata],
    )
    .map_err(|e| format!("{}", e))?;
    Ok(())
}

/// Get recent activities for a note.
pub fn get_activities_for_note(
    conn: &Connection,
    note_id: &str,
    limit: i64,
) -> Result<Vec<ActivityRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, note_id, type, created_at FROM note_activity
             WHERE note_id = ?1 ORDER BY created_at DESC LIMIT ?2",
        )
        .map_err(|e| format!("{}", e))?;
    let rows = stmt
        .query_map(params![note_id, limit], |row| {
            Ok(ActivityRecord {
                id: row.get(0)?,
                note_id: row.get(1)?,
                r#type: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("{}", e))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("{}", e))
}
