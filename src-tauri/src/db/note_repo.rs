use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteRecord {
    pub id: String,
    pub vault_id: String,
    pub path: String,
    pub title: String,
    pub content_hash: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub indexed_at: String,
    pub last_read_at: Option<String>,
    pub read_count: i64,
    pub word_count: i64,
}

/// Insert or update (upsert) a note record. Returns the record.
pub fn upsert_note(
    conn: &Connection,
    vault_id: &str,
    path: &str,
    title: &str,
    content_hash: &str,
    created_at: Option<&str>,
    updated_at: Option<&str>,
    word_count: i64,
) -> Result<NoteRecord, String> {
    let now = super::vault_repo::iso_now();

    // Try to find existing
    let existing = conn.query_row(
        "SELECT id FROM notes WHERE vault_id = ?1 AND path = ?2 AND deleted = 0",
        params![vault_id, path],
        |row| row.get::<_, String>(0),
    );

    match existing {
        Ok(note_id) => {
            conn.execute(
                "UPDATE notes SET title = ?1, content_hash = ?2, updated_at = ?3, indexed_at = ?4, word_count = ?5 WHERE id = ?6",
                params![title, content_hash, updated_at, now, word_count, note_id],
            )
            .map_err(|e| format!("Failed to update note: {}", e))?;
            Ok(NoteRecord {
                id: note_id,
                vault_id: vault_id.to_string(),
                path: path.to_string(),
                title: title.to_string(),
                content_hash: content_hash.to_string(),
                created_at: created_at.map(String::from),
                updated_at: updated_at.map(String::from),
                indexed_at: now,
                last_read_at: None,
                read_count: 0,
                word_count,
            })
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO notes (id, vault_id, path, title, content_hash, created_at, updated_at, indexed_at, word_count, read_count, deleted)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, 0)",
                params![id, vault_id, path, title, content_hash, created_at, updated_at, now, word_count],
            )
            .map_err(|e| format!("Failed to insert note: {}", e))?;
            Ok(NoteRecord {
                id,
                vault_id: vault_id.to_string(),
                path: path.to_string(),
                title: title.to_string(),
                content_hash: content_hash.to_string(),
                created_at: created_at.map(String::from),
                updated_at: updated_at.map(String::from),
                indexed_at: now,
                last_read_at: None,
                read_count: 0,
                word_count,
            })
        }
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Mark a note as deleted (soft delete). Also remove from FTS.
pub fn soft_delete_note(conn: &Connection, vault_id: &str, path: &str) -> Result<(), String> {
    let note_id: String = conn
        .query_row(
            "SELECT id FROM notes WHERE vault_id = ?1 AND path = ?2 AND deleted = 0",
            params![vault_id, path],
            |row| row.get(0),
        )
        .map_err(|e| format!("Note not found: {}", e))?;

    conn.execute(
        "UPDATE notes SET deleted = 1 WHERE id = ?1",
        params![note_id],
    )
    .map_err(|e| format!("{}", e))?;

    // Remove from FTS
    conn.execute(
        "DELETE FROM note_fts WHERE note_id = ?1",
        params![note_id],
    )
    .map_err(|e| format!("{}", e))?;

    Ok(())
}

/// Get all non-deleted notes for a vault.
pub fn get_notes_by_vault(conn: &Connection, vault_id: &str) -> Result<Vec<NoteRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, vault_id, path, title, content_hash, created_at, updated_at, indexed_at, last_read_at, read_count, word_count
             FROM notes WHERE vault_id = ?1 AND deleted = 0 ORDER BY path",
        )
        .map_err(|e| format!("{}", e))?;
    let rows = stmt
        .query_map(params![vault_id], |row| {
            Ok(NoteRecord {
                id: row.get(0)?,
                vault_id: row.get(1)?,
                path: row.get(2)?,
                title: row.get(3)?,
                content_hash: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                indexed_at: row.get(7)?,
                last_read_at: row.get(8)?,
                read_count: row.get(9)?,
                word_count: row.get(10)?,
            })
        })
        .map_err(|e| format!("{}", e))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("{}", e))
}

/// Get a single note record by vault_id and path.
pub fn get_note_by_path(
    conn: &Connection,
    vault_id: &str,
    path: &str,
) -> Result<Option<NoteRecord>, String> {
    let result = conn.query_row(
        "SELECT id, vault_id, path, title, content_hash, created_at, updated_at, indexed_at, last_read_at, read_count, word_count
         FROM notes WHERE vault_id = ?1 AND path = ?2 AND deleted = 0",
        params![vault_id, path],
        |row| {
            Ok(NoteRecord {
                id: row.get(0)?,
                vault_id: row.get(1)?,
                path: row.get(2)?,
                title: row.get(3)?,
                content_hash: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                indexed_at: row.get(7)?,
                last_read_at: row.get(8)?,
                read_count: row.get(9)?,
                word_count: row.get(10)?,
            })
        },
    );
    match result {
        Ok(note) => Ok(Some(note)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("{}", e)),
    }
}

/// Update FTS5 index for a note (delete then insert).
pub fn update_fts(conn: &Connection, note_id: &str, title: &str, body: &str, tags: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM note_fts WHERE note_id = ?1",
        params![note_id],
    )
    .map_err(|e| format!("{}", e))?;
    conn.execute(
        "INSERT INTO note_fts (note_id, title, body, tags) VALUES (?1, ?2, ?3, ?4)",
        params![note_id, title, body, tags],
    )
    .map_err(|e| format!("{}", e))?;
    Ok(())
}

/// Mark note as read (increment read_count and set last_read_at).
pub fn mark_note_read(conn: &Connection, note_id: &str) -> Result<(), String> {
    let now = super::vault_repo::iso_now();
    conn.execute(
        "UPDATE notes SET last_read_at = ?1, read_count = read_count + 1 WHERE id = ?2",
        params![now, note_id],
    )
    .map_err(|e| format!("{}", e))?;
    Ok(())
}

/// Get (path, content_hash) pairs for all non-deleted notes in a vault.
/// Used for incremental indexing.
#[derive(Debug, Serialize)]
pub struct NoteHashEntry {
    pub path: String,
    pub content_hash: String,
}

pub fn get_note_hashes(conn: &Connection, vault_id: &str) -> Result<Vec<NoteHashEntry>, String> {
    let mut stmt = conn
        .prepare("SELECT path, content_hash FROM notes WHERE vault_id = ?1 AND deleted = 0")
        .map_err(|e| format!("{}", e))?;
    let rows = stmt
        .query_map(params![vault_id], |row| {
            Ok(NoteHashEntry {
                path: row.get(0)?,
                content_hash: row.get(1)?,
            })
        })
        .map_err(|e| format!("{}", e))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("{}", e))
}

/// Remove a single note from the index by vault_id and path.
pub fn remove_note_by_path(conn: &Connection, vault_id: &str, path: &str) -> Result<(), String> {
    let note_id: Option<String> = conn
        .query_row(
            "SELECT id FROM notes WHERE vault_id = ?1 AND path = ?2 AND deleted = 0",
            params![vault_id, path],
            |row| row.get(0),
        )
        .ok();
    if let Some(nid) = &note_id {
        conn.execute("DELETE FROM note_fts WHERE note_id = ?1", params![nid])
            .map_err(|e| format!("{}", e))?;
        conn.execute("DELETE FROM note_tags WHERE note_id = ?1", params![nid])
            .map_err(|e| format!("{}", e))?;
        conn.execute("DELETE FROM note_activity WHERE note_id = ?1", params![nid])
            .map_err(|e| format!("{}", e))?;
    }
    conn.execute(
        "DELETE FROM notes WHERE vault_id = ?1 AND path = ?2",
        params![vault_id, path],
    )
    .map_err(|e| format!("{}", e))?;
    Ok(())
}

/// FTS5 search result.
#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub note_id: String,
    pub path: String,
    pub title: String,
    pub title_highlight: String,
    pub body_snippet: String,
    pub rank: f64,
    pub updated_at: Option<String>,
}

/// Search notes using FTS5 with optional tag filter.
pub fn search_notes(
    conn: &Connection,
    vault_id: &str,
    query: &str,
    tag_filter: Option<&str>,
) -> Result<Vec<SearchResult>, String> {
    // Build FTS5 query — escape special FTS characters minimally
    let fts_query = escape_fts_query(query);

    let sql = if let Some(_tag) = tag_filter {
        format!(
            "SELECT f.note_id, f.title,
                    snippet(f, 0, '<mark>', '</mark>', '...', 32) as title_highlight,
                    snippet(f, 1, '<mark>', '</mark>', '...', 32) as body_snippet,
                    n.path, n.updated_at, rank
             FROM note_fts f
             JOIN notes n ON f.note_id = n.id
             WHERE f MATCH ?1
               AND n.deleted = 0
               AND n.vault_id = ?2
               AND n.id IN (
                 SELECT nt.note_id FROM note_tags nt
                 JOIN tags t ON nt.tag_id = t.id
                 WHERE t.normalized_name = ?3
               )
             ORDER BY rank
             LIMIT 50"
        )
    } else {
        format!(
            "SELECT f.note_id, f.title,
                    snippet(f, 0, '<mark>', '</mark>', '...', 32) as title_highlight,
                    snippet(f, 1, '<mark>', '</mark>', '...', 32) as body_snippet,
                    n.path, n.updated_at, rank
             FROM note_fts f
             JOIN notes n ON f.note_id = n.id
             WHERE f MATCH ?1
               AND n.deleted = 0
               AND n.vault_id = ?2
             ORDER BY rank
             LIMIT 50"
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("{}", e))?;

    let results: Vec<SearchResult> = if let Some(tag) = tag_filter {
        let rows = stmt
            .query_map(params![fts_query, vault_id, tag], |row| {
                Ok(SearchResult {
                    note_id: row.get(0)?,
                    title: row.get(1)?,
                    title_highlight: row.get(2)?,
                    body_snippet: row.get(3)?,
                    path: row.get(4)?,
                    updated_at: row.get(5)?,
                    rank: row.get(6)?,
                })
            })
            .map_err(|e| format!("{}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("{}", e))?
    } else {
        let rows = stmt
            .query_map(params![fts_query, vault_id], |row| {
                Ok(SearchResult {
                    note_id: row.get(0)?,
                    title: row.get(1)?,
                    title_highlight: row.get(2)?,
                    body_snippet: row.get(3)?,
                    path: row.get(4)?,
                    updated_at: row.get(5)?,
                    rank: row.get(6)?,
                })
            })
            .map_err(|e| format!("{}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("{}", e))?
    };

    Ok(results)
}

/// Minimal FTS5 query escaping to avoid syntax errors.
fn escape_fts_query(query: &str) -> String {
    // Trim and collapse whitespace
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return "*".to_string();
    }
    // For FTS5, wrap each word in double quotes for safe substring matching
    // Use prefix matching: word* for partial match
    trimmed
        .split_whitespace()
        .map(|w| {
            // Remove FTS special characters, keep alphanumeric + CJK
            let clean: String = w
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
                .collect();
            if clean.is_empty() {
                String::new()
            } else {
                format!("\"{}\"*", clean.replace('"', ""))
            }
        })
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Clear all notes and related data for a vault (used when rebuilding index).
pub fn clear_vault_data(conn: &Connection, vault_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM note_fts WHERE note_id IN (SELECT id FROM notes WHERE vault_id = ?1)",
        params![vault_id],
    )
    .map_err(|e| format!("{}", e))?;
    conn.execute(
        "DELETE FROM note_tags WHERE note_id IN (SELECT id FROM notes WHERE vault_id = ?1)",
        params![vault_id],
    )
    .map_err(|e| format!("{}", e))?;
    conn.execute(
        "DELETE FROM note_activity WHERE note_id IN (SELECT id FROM notes WHERE vault_id = ?1)",
        params![vault_id],
    )
    .map_err(|e| format!("{}", e))?;
    conn.execute(
        "DELETE FROM notes WHERE vault_id = ?1",
        params![vault_id],
    )
    .map_err(|e| format!("{}", e))?;
    Ok(())
}
