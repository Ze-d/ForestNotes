# Review Checklist

## Before Commit

- [ ] `npm test` — all 70 tests pass
- [ ] `npx tsc -b` — no TypeScript errors
- [ ] `npx eslint .` — no lint errors
- [ ] `npx vite build` — frontend builds successfully
- [ ] `cargo check` — Rust compiles (run in `src-tauri/`)

## Code Quality

- [ ] No `any` types without justification
- [ ] `const` used over `let` where applicable
- [ ] No hardcoded secrets, tokens, or API keys
- [ ] Error handling present for all async operations
- [ ] User-facing strings are clear and helpful

## Architecture

- [ ] Markdown files remain the single source of truth
- [ ] SQLite used only for metadata/cache/index
- [ ] New features follow existing module boundaries
- [ ] No new dependencies without documented justification

## Data Safety

- [ ] File operations use path traversal protection (`resolve_safe_path`)
- [ ] Database operations are wrapped in error handling
- [ ] User data not sent to external services

## MVP Boundaries

- [ ] No cloud sync, accounts, or login
- [ ] No plugin system
- [ ] No AI/RAG/embeddings
- [ ] No 3D forest or complex block editor
- [ ] No mobile support
