# ForestNotes Database Schema

## 1. 数据库原则

ForestNotes 使用 SQLite 保存 metadata、索引和统计信息。

重要原则：

```text
Markdown 文件是唯一真实数据源。
SQLite 是缓存、索引和统计层。
```

因此：

- 正文内容可以进入 FTS index，但不应依赖 SQLite 作为唯一正文存储。
- 如果 SQLite 丢失，应可以通过重新扫描 Markdown vault 重建。
- 所有可从 Markdown 文件推导的数据，都应支持重建。

## 2. 表结构

### 2.1 vaults

用于记录最近打开过的 vault。

```sql
CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_opened_at TEXT NOT NULL
);
```

### 2.2 notes

```sql
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
```

说明：

- `path` 是相对于 vault 根目录的路径。
- `content_hash` 用于判断是否需要重新索引。
- `deleted` 用于软删除缓存记录。真实文件删除后可保留短期记录，也可以在重建索引时清理。

### 2.3 tags

```sql
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(vault_id, normalized_name),
  FOREIGN KEY(vault_id) REFERENCES vaults(id)
);
```

说明：

- `name` 保存展示名称。
- `normalized_name` 用于比较和去重。
- MVP 中建议 tag 大小写不敏感，即 `AI` 和 `ai` 归一为同一个 tag。

### 2.4 note_tags

```sql
CREATE TABLE IF NOT EXISTS note_tags (
  note_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY(note_id, tag_id),
  FOREIGN KEY(note_id) REFERENCES notes(id),
  FOREIGN KEY(tag_id) REFERENCES tags(id)
);
```

`source` 可选值：

```text
frontmatter
inline
both
```

### 2.5 note_activity

```sql
CREATE TABLE IF NOT EXISTS note_activity (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY(note_id) REFERENCES notes(id)
);
```

`type` 可选值：

```text
create
read
update
delete
rename
search_hit
```

### 2.6 tag_stats_cache

```sql
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
```

### 2.7 tag_cooccurrence_cache

```sql
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
```

约束：

- 永远保证 `tag_a_id < tag_b_id`，避免重复边。
- 不存储自连接。

### 2.8 note_links

用于后续支持 `[[Wiki Links]]` 和 Markdown links。

```sql
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
```

`type` 可选值：

```text
wiki
markdown
url
```

### 2.9 settings

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 3. FTS5 全文搜索

### 3.1 note_fts

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
  note_id UNINDEXED,
  title,
  body,
  tags,
  tokenize = 'unicode61'
);
```

说明：

- `title` 用于标题检索。
- `body` 用于正文检索。
- `tags` 用于 tag 文本检索。
- `note_id` 不参与索引，只用于回表。

### 3.2 更新策略

当笔记新增或更新时：

```sql
DELETE FROM note_fts WHERE note_id = ?;

INSERT INTO note_fts(note_id, title, body, tags)
VALUES (?, ?, ?, ?);
```

当笔记删除时：

```sql
DELETE FROM note_fts WHERE note_id = ?;
```

### 3.3 搜索示例

```sql
SELECT
  note_fts.note_id,
  note_fts.title,
  snippet(note_fts, 2, '<mark>', '</mark>', '...', 12) AS snippet
FROM note_fts
WHERE note_fts MATCH ?
LIMIT 50;
```

## 4. 索引

```sql
CREATE INDEX IF NOT EXISTS idx_notes_vault_path
ON notes(vault_id, path);

CREATE INDEX IF NOT EXISTS idx_notes_updated_at
ON notes(updated_at);

CREATE INDEX IF NOT EXISTS idx_notes_last_read_at
ON notes(last_read_at);

CREATE INDEX IF NOT EXISTS idx_tags_vault_normalized
ON tags(vault_id, normalized_name);

CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id
ON note_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_activity_note_type_time
ON note_activity(note_id, type, created_at);

CREATE INDEX IF NOT EXISTS idx_cooccurrence_vault_count
ON tag_cooccurrence_cache(vault_id, count);
```

## 5. 数据重建策略

### 5.1 全量重建

用于 MVP 或数据库损坏修复。

```text
Clear notes/tags/note_tags/note_fts/tag_stats_cache/tag_cooccurrence_cache
↓
Scan all .md files
↓
Parse all files
↓
Insert notes/tags/note_tags
↓
Rebuild FTS
↓
Rebuild tag stats
↓
Rebuild co-occurrence
```

### 5.2 增量重建

用于后续优化。

```text
Scan .md files
↓
Compare file path + content_hash
↓
Only reindex changed files
↓
Remove records for missing files
↓
Update impacted tags
↓
Recompute co-occurrence for impacted notes
```

## 6. tag 规范化

MVP 建议：

```ts
function normalizeTag(input: string): string {
  return input
    .trim()
    .replace(/^#/, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}
```

示例：

```text
"#AI"              -> "ai"
"Machine Learning" -> "machine-learning"
"  Transformer "   -> "transformer"
```

## 7. 注意事项

### 7.1 frontmatter 错误

如果 frontmatter 解析失败：

- 不阻塞整篇文章读取。
- 在 UI 中显示 warning。
- 正文仍然可以编辑。
- tags 可以退化为只提取 inline tags。

### 7.2 文件路径

数据库只保存相对路径，避免 vault 迁移后全部失效。

### 7.3 时间格式

统一使用 ISO 8601 字符串。

例如：

```text
2026-06-10T17:30:00+09:00
```

### 7.4 删除策略

MVP 可以简单处理：

- 文件删除后，从 notes 和 FTS 中移除。
- activity 可以保留，也可以删除。

建议先直接删除相关缓存，降低复杂度。
