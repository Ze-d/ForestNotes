/// ForestNotes Forest Engine
///
/// Queries the database for tag statistics and co-occurrence,
/// then computes the Knowledge Forest graph.
use rusqlite::{params, Connection};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ForestNode {
    pub id: String,
    pub label: String,
    #[serde(rename = "noteCount")]
    pub note_count: i64,
    pub health: f64,
    pub status: String,
    pub size: f64,
    #[serde(rename = "readCount30d")]
    pub read_count_30d: i64,
    #[serde(rename = "updateCount30d")]
    pub update_count_30d: i64,
    #[serde(rename = "lastActiveAt")]
    pub last_active_at: Option<String>,
    #[serde(rename = "staleDays")]
    pub stale_days: i64,
}

#[derive(Debug, Serialize)]
pub struct ForestEdge {
    pub source: String,
    pub target: String,
    pub weight: i64,
}

#[derive(Debug, Serialize)]
pub struct ForestGraph {
    pub nodes: Vec<ForestNode>,
    pub edges: Vec<ForestEdge>,
    #[serde(rename = "generatedAt")]
    pub generated_at: String,
}

/// Generate the complete forest graph for a vault.
pub fn generate_forest_graph(conn: &Connection, vault_id: &str) -> Result<ForestGraph, String> {
    let now = super::db::vault_repo::iso_now();
    let now_date = parse_iso_date(&now);

    // 1. Get tag stats from DB
    let tag_stats = query_tag_stats(conn, vault_id, now_date)?;

    // 2. Get co-occurrence from DB
    let cooccurrence = query_cooccurrence(conn, vault_id)?;

    // 3. Compute nodes
    let nodes: Vec<ForestNode> = tag_stats
        .into_iter()
        .map(|ts| {
            let health = compute_health(ts.read_count_30d, ts.update_count_30d, ts.stale_days);
            let status = get_tree_status(health, ts.stale_days);
            let size = compute_tree_size(ts.note_count);

            ForestNode {
                id: ts.normalized_name.clone(),
                label: ts.name,
                note_count: ts.note_count,
                health,
                status: status.to_string(),
                size,
                read_count_30d: ts.read_count_30d,
                update_count_30d: ts.update_count_30d,
                last_active_at: ts.last_active_at,
                stale_days: ts.stale_days,
            }
        })
        .collect();

    // 4. Build edges
    let edges: Vec<ForestEdge> = cooccurrence
        .into_iter()
        .map(|(tag_a, tag_b, count)| ForestEdge {
            source: tag_a,
            target: tag_b,
            weight: count,
        })
        .collect();

    Ok(ForestGraph {
        nodes,
        edges,
        generated_at: now,
    })
}

// ─── DB Queries ───────────────────────────────────

struct TagStatRow {
    name: String,
    normalized_name: String,
    note_count: i64,
    read_count_30d: i64,
    update_count_30d: i64,
    last_active_at: Option<String>,
    stale_days: i64,
}

fn query_tag_stats(conn: &Connection, vault_id: &str, now: i64) -> Result<Vec<TagStatRow>, String> {
    let cutoff_iso = days_to_iso(now - 30 * 86400);

    let mut stmt = conn.prepare(
        "SELECT
            t.id, t.name, t.normalized_name,
            (SELECT COUNT(*) FROM note_tags nt2 JOIN notes n2 ON nt2.note_id = n2.id
             WHERE nt2.tag_id = t.id AND n2.deleted = 0) as note_count,
            COALESCE((SELECT COUNT(*) FROM note_activity a
             WHERE a.note_id IN (SELECT nt3.note_id FROM note_tags nt3 WHERE nt3.tag_id = t.id)
             AND a.type = 'read' AND a.created_at >= ?2), 0) as read_count_30d,
            COALESCE((SELECT COUNT(*) FROM note_activity a
             WHERE a.note_id IN (SELECT nt4.note_id FROM note_tags nt4 WHERE nt4.tag_id = t.id)
             AND a.type = 'update' AND a.created_at >= ?2), 0) as update_count_30d,
            COALESCE((SELECT MAX(a2.created_at) FROM note_activity a2
             WHERE a2.note_id IN (SELECT nt5.note_id FROM note_tags nt5 WHERE nt5.tag_id = t.id)), NULL) as last_active_at
        FROM tags t
        WHERE t.vault_id = ?1
        ORDER BY note_count DESC"
    )
    .map_err(|e| format!("{}", e))?;

    let rows = stmt.query_map(params![vault_id, cutoff_iso], |row| {
        let last_active: Option<String> = row.get(5)?;
        let stale_days = match &last_active {
            Some(date_str) => {
                let epoch = parse_iso_date(date_str);
                std::cmp::max(0, now - epoch)
            }
            None => 365,
        };

        Ok(TagStatRow {
            name: row.get(0)?,
            normalized_name: row.get(1)?,
            note_count: row.get(2)?,
            read_count_30d: row.get(3)?,
            update_count_30d: row.get(4)?,
            last_active_at: last_active,
            stale_days,
        })
    })
    .map_err(|e| format!("{}", e))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("{}", e))
}

fn query_cooccurrence(conn: &Connection, vault_id: &str) -> Result<Vec<(String, String, i64)>, String> {
    let sql = r#"
        SELECT t1.normalized_name, t2.normalized_name, COUNT(*) as cnt
        FROM note_tags nt1
        JOIN note_tags nt2 ON nt1.note_id = nt2.note_id AND nt1.tag_id < nt2.tag_id
        JOIN tags t1 ON nt1.tag_id = t1.id
        JOIN tags t2 ON nt2.tag_id = t2.id
        JOIN notes n ON nt1.note_id = n.id
        WHERE t1.vault_id = ?1 AND n.deleted = 0
        GROUP BY t1.normalized_name, t2.normalized_name
        ORDER BY cnt DESC
    "#;

    let mut stmt = conn.prepare(sql).map_err(|e| format!("{}", e))?;
    let rows = stmt
        .query_map(params![vault_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| format!("{}", e))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("{}", e))
}

// ─── Algorithm Functions ──────────────────────────

fn compute_tree_size(note_count: i64) -> f64 {
    (note_count as f64 + 1.0).ln()
}

fn compute_health(read_30d: i64, update_30d: i64, stale_days: i64) -> f64 {
    let activity = 0.6 * (read_30d as f64 + 1.0).ln() + 0.4 * (update_30d as f64 + 1.0).ln();
    let decay = (-stale_days as f64 / 90.0).exp();
    let raw = activity * decay;
    (raw / 3.0).clamp(0.0, 1.0)
}

fn get_tree_status(health: f64, stale_days: i64) -> &'static str {
    if stale_days >= 180 {
        "dormant"
    } else if stale_days >= 90 {
        "stale"
    } else if health >= 0.65 {
        "healthy"
    } else {
        "normal"
    }
}

// ─── Date Utilities ───────────────────────────────

/// Parse ISO 8601 date to days since epoch (simplified).
fn parse_iso_date(s: &str) -> i64 {
    if s.len() < 10 {
        return 0;
    }
    let year: i64 = s[0..4].parse().unwrap_or(2026);
    let month: i64 = s[5..7].parse().unwrap_or(1);
    let day: i64 = s[8..10].parse().unwrap_or(1);
    days_from_ymd(year, month as u32, day as u32)
}

fn days_to_iso(days: i64) -> String {
    let (y, m, d) = days_to_ymd(days);
    format!("{:04}-{:02}-{:02}T00:00:00.000Z", y, m, d)
}

fn days_from_ymd(y: i64, m: u32, d: u32) -> i64 {
    let mut days = 0i64;
    for year in 1970..y {
        days += if is_leap(year) { 366 } else { 365 };
    }
    let month_days = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    for month in 1..(m as usize) {
        days += month_days[month - 1];
    }
    days + d as i64 - 1
}

fn days_to_ymd(mut days: i64) -> (i64, u32, u32) {
    let mut year = 1970i64;
    loop {
        let dy = if is_leap(year) { 366 } else { 365 };
        if days < dy {
            break;
        }
        days -= dy;
        year += 1;
    }
    let md = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut month = 1u32;
    for &mdy in md.iter() {
        if days < mdy {
            break;
        }
        days -= mdy;
        month += 1;
    }
    (year, month, (days + 1) as u32)
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
}
