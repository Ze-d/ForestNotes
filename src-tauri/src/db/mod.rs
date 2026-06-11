/// ForestNotes database module.
///
/// Manages the SQLite connection lifecycle, migrations, and provides
/// access to repository functions.
///
/// Architecture:
///   Tauri State → rusqlite::Connection (behind std::sync::Mutex)
///
/// Repositories are free functions that take `&Connection` + params.

mod migrations;
pub mod activity_repo;
pub mod commands;
pub mod note_repo;
pub mod tag_repo;
pub mod vault_repo;

use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

/// Wraps a SQLite connection for thread-safe access via Tauri state.
pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    /// Open (or create) the database file and run migrations.
    pub fn open(app_data_dir: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;

        let db_path = app_data_dir.join("forestnotes.db");

        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        // Enable WAL mode for better read concurrency
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| format!("Failed to set WAL mode: {}", e))?;

        // Enable foreign keys
        conn.execute_batch("PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

        // Run migrations
        run_migrations(&conn)?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    for (i, sql) in migrations::MIGRATION_SQL.iter().enumerate() {
        conn.execute(sql, [])
            .map_err(|e| format!("Migration {} failed: {}", i, e))?;
    }
    Ok(())
}
