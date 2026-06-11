use serde::Serialize;
use std::fs;
use std::path::Path;

/// Directories to skip during vault scanning
const IGNORE_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    ".obsidian",
    "dist",
    "build",
    "target",
    ".trash",
    ".DS_Store",
];

#[derive(Debug, Clone, Serialize)]
pub struct VaultFileEntry {
    /// Relative path from vault root
    pub path: String,
    /// File name (without extension)
    pub name: String,
    /// File size in bytes
    pub size: u64,
    /// Whether this is a directory (for future folder support)
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct VaultScanResult {
    pub vault_path: String,
    pub vault_name: String,
    pub files: Vec<VaultFileEntry>,
    pub total_count: usize,
}

/// Scan a directory recursively for `.md` files.
/// Returns entries with paths relative to the vault root.
pub fn scan_vault(vault_path: &str) -> Result<VaultScanResult, String> {
    let root = Path::new(vault_path);
    if !root.exists() {
        return Err(format!("Vault path does not exist: {}", vault_path));
    }
    if !root.is_dir() {
        return Err(format!("Vault path is not a directory: {}", vault_path));
    }

    let vault_name = root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    let mut files = Vec::new();
    scan_dir(root, root, &mut files)?;

    // Sort by path for deterministic listing
    files.sort_by(|a, b| a.path.cmp(&b.path));

    let total_count = files.len();

    Ok(VaultScanResult {
        vault_path: vault_path.to_string(),
        vault_name,
        files,
        total_count,
    })
}

fn scan_dir(
    root: &Path,
    dir: &Path,
    files: &mut Vec<VaultFileEntry>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| {
        format!("Failed to read directory '{}': {}", dir.display(), e)
    })?;

    for entry in entries {
        let entry = entry.map_err(|e| {
            format!("Failed to read entry in '{}': {}", dir.display(), e)
        })?;
        let path = entry.path();
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // Skip hidden files/dirs (except .md files which are not hidden)
        if file_name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            // Skip ignored directories
            if IGNORE_DIRS.contains(&file_name.as_str()) {
                continue;
            }
            scan_dir(root, &path, files)?;
        } else {
            // Only collect .md files
            if path.extension().map(|e| e == "md").unwrap_or(false) {
                let rel_path = path
                    .strip_prefix(root)
                    .map_err(|e| format!("Failed to compute relative path: {}", e))?
                    .to_string_lossy()
                    .to_string();

                let name = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| file_name.clone());

                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

                files.push(VaultFileEntry {
                    path: rel_path,
                    name,
                    size,
                    is_dir: false,
                });
            }
        }
    }
    Ok(())
}

/// Read a note file from the vault.
pub fn read_note_file(vault_path: &str, relative_path: &str) -> Result<String, String> {
    let full_path = resolve_safe_path(vault_path, relative_path)?;
    fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read file '{}': {}", full_path.display(), e))
}

/// Save content to a note file in the vault.
/// Creates parent directories if they don't exist.
pub fn save_note_file(
    vault_path: &str,
    relative_path: &str,
    content: &str,
) -> Result<(), String> {
    let full_path = resolve_safe_path(vault_path, relative_path)?;

    // Ensure parent directories exist
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory '{}': {}", parent.display(), e))?;
    }

    fs::write(&full_path, content)
        .map_err(|e| format!("Failed to write file '{}': {}", full_path.display(), e))
}

/// Create a new note file with default frontmatter.
/// Returns the relative path of the created file.
pub fn create_note_file(
    vault_path: &str,
    relative_path: &str,
    title: &str,
) -> Result<String, String> {
    let full_path = resolve_safe_path(vault_path, relative_path)?;

    if full_path.exists() {
        return Err(format!(
            "File already exists: {}",
            relative_path
        ));
    }

    // Ensure parent directories exist
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory '{}': {}", parent.display(), e))?;
    }

    let now = chrono_now();
    let frontmatter = format!(
        "---\ntitle: {}\ntags: []\ncreated_at: {}\nupdated_at: {}\n---\n\n",
        title, now, now
    );

    fs::write(&full_path, &frontmatter)
        .map_err(|e| format!("Failed to create file '{}': {}", full_path.display(), e))?;

    Ok(relative_path.to_string())
}

/// Rename (move) a note file within the vault.
pub fn rename_note_file(
    vault_path: &str,
    old_relative_path: &str,
    new_relative_path: &str,
) -> Result<String, String> {
    let old_full = resolve_safe_path(vault_path, old_relative_path)?;
    let new_full = resolve_safe_path(vault_path, new_relative_path)?;

    if !old_full.exists() {
        return Err(format!("Source file does not exist: {}", old_relative_path));
    }
    if new_full.exists() {
        return Err(format!("Target file already exists: {}", new_relative_path));
    }

    // Ensure parent directories exist
    if let Some(parent) = new_full.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory '{}': {}", parent.display(), e))?;
    }

    fs::rename(&old_full, &new_full)
        .map_err(|e| format!("Failed to rename file: {}", e))?;

    Ok(new_relative_path.to_string())
}

/// Delete a note file from the vault.
pub fn delete_note_file(vault_path: &str, relative_path: &str) -> Result<(), String> {
    let full_path = resolve_safe_path(vault_path, relative_path)?;

    if !full_path.exists() {
        return Err(format!("File does not exist: {}", relative_path));
    }

    fs::remove_file(&full_path)
        .map_err(|e| format!("Failed to delete file '{}': {}", full_path.display(), e))
}

/// Resolve a relative path within the vault, with security checks.
fn resolve_safe_path(vault_path: &str, relative_path: &str) -> Result<std::path::PathBuf, String> {
    let full_path = Path::new(vault_path).join(relative_path);

    let canonical_vault = Path::new(vault_path)
        .canonicalize()
        .map_err(|e| format!("Failed to resolve vault path: {}", e))?;

    // Canonicalize the file path if it exists; otherwise resolve its parent
    let canonical_file = if full_path.exists() {
        full_path
            .canonicalize()
            .map_err(|e| format!("Failed to resolve file path: {}", e))?
    } else {
        // For new files: check the parent directory
        let parent = full_path.parent().unwrap_or(Path::new(vault_path));
        let canonical_parent = if parent.exists() {
            parent
                .canonicalize()
                .map_err(|e| format!("Failed to resolve parent path: {}", e))?
        } else {
            // Parent doesn't exist yet — create from canonical_vault + relative parent
            canonical_vault.join(
                parent
                    .strip_prefix(vault_path)
                    .map_err(|e| format!("Path error: {}", e))?,
            )
        };
        canonical_parent.join(
            full_path
                .file_name()
                .ok_or("Invalid file name".to_string())?,
        )
    };

    if !canonical_file.starts_with(&canonical_vault) {
        return Err("Access denied: file is outside the vault".to_string());
    }

    Ok(full_path)
}

/// Get current time in ISO 8601 format.
fn chrono_now() -> String {
    // Simple ISO 8601 without external chrono crate dependency
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    // Basic ISO 8601: YYYY-MM-DDTHH:MM:SS+00:00
    let days_since_epoch = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Calculate date from days since epoch (simplified, good enough for MVP)
    let mut year = 1970i64;
    let mut remaining_days = days_since_epoch as i64;

    loop {
        let days_in_year = if is_leap(year) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let month_days = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1usize;
    for &md in month_days.iter() {
        if remaining_days < md {
            break;
        }
        remaining_days -= md;
        month += 1;
    }
    let day = remaining_days + 1;

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}+09:00",
        year, month, day, hours, minutes, seconds
    )
}

fn is_leap(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}
