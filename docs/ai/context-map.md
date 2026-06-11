# Context Map — Key Files

## Specifications & Planning

| File | Purpose |
|------|---------|
| [docs/specs/product-spec.md](../specs/product-spec.md) | Product requirements, MVP scope |
| [docs/specs/database-schema.md](../specs/database-schema.md) | SQLite tables, FTS5, indexes |
| [docs/specs/forest-engine.md](../specs/forest-engine.md) | Tag metrics, health, co-occurrence algorithms |
| [docs/specs/tasks.md](../specs/tasks.md) | Implementation phases with acceptance criteria |

## Architecture

| File | Purpose |
|------|---------|
| [docs/architecture/overview.md](../architecture/overview.md) | Tech stack, module structure, data flow |

## Rust Backend

| File | Purpose |
|------|---------|
| [src-tauri/src/lib.rs](../../src-tauri/src/lib.rs) | Tauri entry point, all command registrations, DB init |
| [src-tauri/src/db/mod.rs](../../src-tauri/src/db/mod.rs) | Database connection, migrations runner |
| [src-tauri/src/db/vault_repo.rs](../../src-tauri/src/db/vault_repo.rs) | Vault CRUD, ID generation, ISO date util |
| [src-tauri/src/db/note_repo.rs](../../src-tauri/src/db/note_repo.rs) | Note CRUD, FTS5 search, content hash queries |
| [src-tauri/src/db/tag_repo.rs](../../src-tauri/src/db/tag_repo.rs) | Tag CRUD, note_tags linking |
| [src-tauri/src/db/activity_repo.rs](../../src-tauri/src/db/activity_repo.rs) | Activity logging, queries |
| [src-tauri/src/db/commands.rs](../../src-tauri/src/db/commands.rs) | All Tauri DB command handlers |
| [src-tauri/src/vault.rs](../../src-tauri/src/vault.rs) | File system operations (scan/read/write/rename/delete) |
| [src-tauri/src/forest.rs](../../src-tauri/src/forest.rs) | Forest graph computation (DB queries + algorithms) |

## TypeScript Frontend

| File | Purpose |
|------|---------|
| [src/App.tsx](../../src/App.tsx) | Root component with ErrorBoundary |
| [src/stores/appStore.ts](../../src/stores/appStore.ts) | Central Zustand store (all app state + actions) |
| [src/db/client.ts](../../src/db/client.ts) | Tauri invoke wrappers for all DB commands |
| [src/features/vault/vaultApi.ts](../../src/features/vault/vaultApi.ts) | Tauri invoke wrappers for file system commands |
| [src/core/markdown/parser.ts](../../src/core/markdown/parser.ts) | Frontmatter + inline tag parser |
| [src/core/forest/engine.ts](../../src/core/forest/engine.ts) | Forest metric algorithms (health, size, co-occurrence) |
| [src/components/layout/](../../src/components/layout/) | TopBar, Sidebar, DetailPanel, NotesView, ErrorBoundary |
| [src/components/editor/](../../src/components/editor/) | EditorPanel, MarkdownEditor (CodeMirror 6) |
| [src/components/forest/](../../src/components/forest/) | ForestView, ForestCanvas (D3), ForestDetailPanel |
| [src/components/search/](../../src/components/search/) | SearchPanel (FTS5 results) |
| [src/components/settings/](../../src/components/settings/) | SettingsPanel |
