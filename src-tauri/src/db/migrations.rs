/// SQL DDL migrations for ForestNotes.
/// All migrations are idempotent (CREATE TABLE IF NOT EXISTS).

pub const MIGRATION_SQL: &[&str] = &[
    // ─── Core tables ──────────────────────────────

    r#"
    CREATE TABLE IF NOT EXISTS vaults (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_opened_at TEXT NOT NULL
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT,
        indexed_at TEXT NOT NULL,
        last_read_at TEXT,
        read_count INTEGER NOT NULL DEFAULT 0,
        word_count INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0,
        UNIQUE(vault_id, path),
        FOREIGN KEY(vault_id) REFERENCES vaults(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(vault_id, normalized_name),
        FOREIGN KEY(vault_id) REFERENCES vaults(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS note_tags (
        note_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        source TEXT NOT NULL,
        PRIMARY KEY(note_id, tag_id),
        FOREIGN KEY(note_id) REFERENCES notes(id),
        FOREIGN KEY(tag_id) REFERENCES tags(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS note_activity (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata_json TEXT,
        FOREIGN KEY(note_id) REFERENCES notes(id)
    );
    "#,

    // ─── Cache tables ─────────────────────────────

    r#"
    CREATE TABLE IF NOT EXISTS tag_stats_cache (
        tag_id TEXT PRIMARY KEY,
        note_count INTEGER NOT NULL DEFAULT 0,
        read_count_30d INTEGER NOT NULL DEFAULT 0,
        update_count_30d INTEGER NOT NULL DEFAULT 0,
        last_active_at TEXT,
        stale_days INTEGER NOT NULL DEFAULT 0,
        health REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'normal',
        updated_at TEXT NOT NULL,
        FOREIGN KEY(tag_id) REFERENCES tags(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS tag_cooccurrence_cache (
        vault_id TEXT NOT NULL,
        tag_a_id TEXT NOT NULL,
        tag_b_id TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(vault_id, tag_a_id, tag_b_id),
        FOREIGN KEY(vault_id) REFERENCES vaults(id),
        FOREIGN KEY(tag_a_id) REFERENCES tags(id),
        FOREIGN KEY(tag_b_id) REFERENCES tags(id)
    );
    "#,

    // ─── Links ────────────────────────────────────

    r#"
    CREATE TABLE IF NOT EXISTS note_links (
        id TEXT PRIMARY KEY,
        source_note_id TEXT NOT NULL,
        target_raw TEXT NOT NULL,
        target_note_id TEXT,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(source_note_id) REFERENCES notes(id),
        FOREIGN KEY(target_note_id) REFERENCES notes(id)
    );
    "#,

    // ─── Settings ─────────────────────────────────

    r#"
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    "#,

    // ─── FTS5 ─────────────────────────────────────

    r#"
    CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
        note_id UNINDEXED,
        title,
        body,
        tags,
        tokenize = 'unicode61'
    );
    "#,

    // ─── Indexes ──────────────────────────────────

    "CREATE INDEX IF NOT EXISTS idx_notes_vault_path ON notes(vault_id, path);",
    "CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);",
    "CREATE INDEX IF NOT EXISTS idx_notes_last_read_at ON notes(last_read_at);",
    "CREATE INDEX IF NOT EXISTS idx_tags_vault_normalized ON tags(vault_id, normalized_name);",
    "CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);",
    "CREATE INDEX IF NOT EXISTS idx_activity_note_type_time ON note_activity(note_id, type, created_at);",
    "CREATE INDEX IF NOT EXISTS idx_cooccurrence_vault_count ON tag_cooccurrence_cache(vault_id, count);",
];
