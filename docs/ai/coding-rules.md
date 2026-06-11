# Coding Rules

## General

- **Chinese comments** for business logic explanations (per project convention)
- **English** for code identifiers, commit messages, and API docs
- Prefer readability over cleverness
- Single-purpose functions — if it does two things, split it

## TypeScript

- `const` over `let` — no `var`
- No `any` without explicit justification comment
- Barrel exports via `index.ts` per module
- Types in `src/types/`, not scattered across files
- Use `type` import for type-only imports

## React

- Functional components only
- Zustand for global state, `useState` for local UI state
- Co-locate tests with source (`__tests__/`)
- Components named by domain: `ForestCanvas`, `SearchPanel`, `DetailPanel`

## Rust

- Module per domain: `db/`, `vault.rs`, `forest.rs`
- Repository pattern for database access
- Use `rusqlite::params!` for SQL parameters
- `#[tauri::command]` functions in `commands.rs` or `lib.rs`
- `serde::Serialize` for all types crossing the IPC boundary

## CSS

- CSS custom properties for theming (`--color-*`)
- No inline styles except for D3 dynamic values
- Mobile-first responsive design not required (desktop app)
- Dark mode via `prefers-color-scheme: dark`

## Git

- Never commit `node_modules/`, `target/`, `dist/`
- Meaningful commit messages in English
- One logical change per commit
