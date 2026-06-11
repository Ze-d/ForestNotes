/// Tauri commands that bridge frontend ↔ database repositories.
use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::activity_repo;
use super::note_repo;
use super::tag_repo;
use super::vault_repo;

// ─── Types ────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexSingleInput {
    pub vault_id: String,
    pub path: String,
    pub title: String,
    pub tags: Vec<String>,
    pub content_hash: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub word_count: i64,
    pub body: String,
    pub source_tag_map: Vec<TagSourceEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TagSourceEntry {
    pub name: String,
    pub normalized: String,
    pub source: String,
}

#[derive(Debug, Serialize)]
pub struct IndexResult {
    pub note_id: String,
    pub tags_indexed: usize,
}

// ─── Commands ─────────────────────────────────────

/// Initialize a vault in the database. Clears old index data if rebuilding.
/// Returns the vault_id.
#[tauri::command]
pub fn init_vault_db(
    db: State<'_, Database>,
    vault_path: String,
    vault_name: String,
) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    let vault = vault_repo::insert_or_update_vault(&conn, &vault_path, &vault_name)?;
    Ok(vault.id)
}

/// Index (upsert) a single note in the database.
#[tauri::command]
pub fn index_single_note_db(
    db: State<'_, Database>,
    input: IndexSingleInput,
) -> Result<IndexResult, String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

    // Upsert note record
    let note = note_repo::upsert_note(
        &conn,
        &input.vault_id,
        &input.path,
        &input.title,
        &input.content_hash,
        input.created_at.as_deref(),
        input.updated_at.as_deref(),
        input.word_count,
    )?;

    // Clear old tag links
    tag_repo::unlink_note_tags(&conn, &note.id)?;

    // Ensure tags and create links
    for entry in &input.source_tag_map {
        let tag_id = tag_repo::ensure_tag(
            &conn,
            &input.vault_id,
            &entry.name,
            &entry.normalized,
        )?;
        tag_repo::link_note_tag(&conn, &note.id, &tag_id, &entry.source)?;
    }

    // Update FTS index
    let tags_str = input.tags.join(" ");
    note_repo::update_fts(&conn, &note.id, &input.title, &input.body, &tags_str)?;

    Ok(IndexResult {
        note_id: note.id,
        tags_indexed: input.source_tag_map.len(),
    })
}

/// Clear all index data for a vault (before full rebuild).
#[tauri::command]
pub fn clear_vault_index_db(
    db: State<'_, Database>,
    vault_id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    note_repo::clear_vault_data(&conn, &vault_id)?;
    tag_repo::clear_vault_tags(&conn, &vault_id)?;
    Ok(())
}

/// Get all tags for a vault with note counts.
#[tauri::command]
pub fn get_tags_db(
    db: State<'_, Database>,
    vault_id: String,
) -> Result<Vec<tag_repo::TagRecord>, String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    tag_repo::get_tags_for_vault(&conn, &vault_id)
}

/// Get the last opened vault path (for session restore).
#[tauri::command]
pub fn get_last_vault_path_db(
    db: State<'_, Database>,
) -> Result<Option<String>, String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    vault_repo::get_last_vault_path(&conn)
}

/// Record a note read activity.
#[tauri::command]
pub fn record_read_activity_db(
    db: State<'_, Database>,
    note_id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    note_repo::mark_note_read(&conn, &note_id)?;
    activity_repo::insert_activity(&conn, &note_id, "read", None)?;
    Ok(())
}

/// Record a note update activity.
#[tauri::command]
pub fn record_update_activity_db(
    db: State<'_, Database>,
    note_id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    activity_repo::insert_activity(&conn, &note_id, "update", None)?;
    Ok(())
}

/// Get (path, content_hash) pairs for incremental indexing.
#[tauri::command]
pub fn get_note_hashes_db(
    db: State<'_, Database>,
    vault_id: String,
) -> Result<Vec<note_repo::NoteHashEntry>, String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    note_repo::get_note_hashes(&conn, &vault_id)
}

/// Remove a note from the index (for deleted files).
#[tauri::command]
pub fn remove_note_db(
    db: State<'_, Database>,
    vault_id: String,
    path: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    note_repo::remove_note_by_path(&conn, &vault_id, &path)
}

/// Full-text search with optional tag filter.
#[tauri::command]
pub fn search_notes_db(
    db: State<'_, Database>,
    vault_id: String,
    query: String,
    tag_filter: Option<String>,
) -> Result<Vec<note_repo::SearchResult>, String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    note_repo::search_notes(&conn, &vault_id, &query, tag_filter.as_deref())
}

/// Get note metadata by vault path.
#[tauri::command]
pub fn get_note_by_path_db(
    db: State<'_, Database>,
    vault_id: String,
    path: String,
) -> Result<Option<note_repo::NoteRecord>, String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    note_repo::get_note_by_path(&conn, &vault_id, &path)
}

/// Get recent activities for a note.
#[tauri::command]
pub fn get_note_activities_db(
    db: State<'_, Database>,
    note_id: String,
) -> Result<Vec<activity_repo::ActivityRecord>, String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    activity_repo::get_activities_for_note(&conn, &note_id, 20)
}
