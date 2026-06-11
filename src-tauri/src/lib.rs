mod db;
mod forest;
mod vault;

use tauri::Manager;

use forest::generate_forest_graph;

use db::commands::{
    clear_vault_index_db, get_last_vault_path_db, get_note_activities_db, get_note_by_path_db,
    get_note_hashes_db, get_tags_db, index_single_note_db, init_vault_db,
    record_read_activity_db, record_update_activity_db, remove_note_db, search_notes_db,
};
use db::Database;
use vault::{
    create_note_file, delete_note_file, read_note_file, rename_note_file, save_note_file,
    scan_vault, VaultScanResult,
};

// ─── File system commands ──────────────────────────────────

#[tauri::command]
fn scan_vault_cmd(vault_path: String) -> Result<VaultScanResult, String> {
    scan_vault(&vault_path)
}

#[tauri::command]
fn read_note_file_cmd(vault_path: String, relative_path: String) -> Result<String, String> {
    read_note_file(&vault_path, &relative_path)
}

#[tauri::command]
fn save_note_file_cmd(
    vault_path: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    save_note_file(&vault_path, &relative_path, &content)
}

#[tauri::command]
fn create_note_file_cmd(
    vault_path: String,
    relative_path: String,
    title: String,
) -> Result<String, String> {
    create_note_file(&vault_path, &relative_path, &title)
}

#[tauri::command]
fn rename_note_file_cmd(
    vault_path: String,
    old_relative_path: String,
    new_relative_path: String,
) -> Result<String, String> {
    rename_note_file(&vault_path, &old_relative_path, &new_relative_path)
}

#[tauri::command]
fn delete_note_file_cmd(vault_path: String, relative_path: String) -> Result<(), String> {
    delete_note_file(&vault_path, &relative_path)
}

// ─── Forest Engine command ──────────────────────────────

#[tauri::command]
fn get_forest_graph_cmd(
    db: tauri::State<'_, db::Database>,
    vault_id: String,
) -> Result<forest::ForestGraph, String> {
    let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
    generate_forest_graph(&conn, &vault_id)
}

// ─── Entry point ───────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?;
            let database = Database::open(app_data_dir)?;
            app.manage(database);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // File system
            scan_vault_cmd,
            read_note_file_cmd,
            save_note_file_cmd,
            create_note_file_cmd,
            rename_note_file_cmd,
            delete_note_file_cmd,
            // Database
            init_vault_db,
            index_single_note_db,
            clear_vault_index_db,
            get_tags_db,
            get_last_vault_path_db,
            record_read_activity_db,
            record_update_activity_db,
            get_note_hashes_db,
            remove_note_db,
            search_notes_db,
            get_note_by_path_db,
            get_note_activities_db,
            get_forest_graph_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
