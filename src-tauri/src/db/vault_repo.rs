use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultRecord {
    pub id: String,
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub last_opened_at: String,
}

pub fn insert_or_update_vault(conn: &Connection, path: &str, name: &str) -> Result<VaultRecord, String> {
    let now = iso_now();

    // Try to find existing vault by path
    let existing = conn
        .query_row(
            "SELECT id, path, name, created_at, last_opened_at FROM vaults WHERE path = ?1",
            [path],
            |row| {
                Ok(VaultRecord {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    created_at: row.get(3)?,
                    last_opened_at: row.get(4)?,
                })
            },
        );

    match existing {
        Ok(mut vault) => {
            // Update last_opened_at and name
            vault.last_opened_at = now.clone();
            vault.name = name.to_string();
            conn.execute(
                "UPDATE vaults SET last_opened_at = ?1, name = ?2 WHERE id = ?3",
                rusqlite::params![vault.last_opened_at, vault.name, vault.id],
            )
            .map_err(|e| format!("Failed to update vault: {}", e))?;
            Ok(vault)
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO vaults (id, path, name, created_at, last_opened_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![id, path, name, now, now],
            )
            .map_err(|e| format!("Failed to insert vault: {}", e))?;
            Ok(VaultRecord {
                id,
                path: path.to_string(),
                name: name.to_string(),
                created_at: now.clone(),
                last_opened_at: now,
            })
        }
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

pub fn get_vaults(conn: &Connection) -> Result<Vec<VaultRecord>, String> {
    let mut stmt = conn
        .prepare("SELECT id, path, name, created_at, last_opened_at FROM vaults ORDER BY last_opened_at DESC")
        .map_err(|e| format!("{}", e))?;
    let rows = stmt
        .query_map([], |row| {
            Ok(VaultRecord {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
                last_opened_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("{}", e))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("{}", e))
}

pub fn get_last_vault_path(conn: &Connection) -> Result<Option<String>, String> {
    let result = conn
        .query_row(
            "SELECT path FROM vaults ORDER BY last_opened_at DESC LIMIT 1",
            [],
            |row| row.get(0),
        );
    match result {
        Ok(path) => Ok(Some(path)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("{}", e)),
    }
}

pub fn iso_now() -> String {
    // Use chrono-style formatting via std
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let nsecs = now.subsec_nanos();

    // Simple ISO 8601
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;
    let millis = nsecs / 1_000_000;

    let (year, month, day) = days_to_date(days as i64);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        year, month, day, hours, minutes, seconds, millis
    )
}

fn days_to_date(mut days: i64) -> (i64, u32, u32) {
    let mut year = 1970i64;
    loop {
        let dy = if is_leap(year) { 366 } else { 365 };
        if days < dy { break; }
        days -= dy;
        year += 1;
    }
    let month_days = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut month = 1u32;
    for &md in month_days.iter() {
        if days < md { break; }
        days -= md;
        month += 1;
    }
    (year, month, (days + 1) as u32)
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
}
