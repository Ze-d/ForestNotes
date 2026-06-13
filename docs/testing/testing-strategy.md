# Testing Strategy

## Layers

| Layer | Tool | Scope | Location |
|-------|------|-------|----------|
| Unit | Vitest | Pure functions: parser, tags, stats, forest engine | `src/**/__tests__/` |
| Component | Vitest + React Testing Library | UI component rendering (future) | `src/**/__tests__/` |
| Integration | Vitest | Rust↔TS IPC, DB operations (future) | `tests/integration/` |
| E2E | Tauri test | Full desktop app (future) | `tests/e2e/` |

## Current Coverage (MVP)

| Module | Tests | Status |
|--------|-------|--------|
| `core/markdown/tags.ts` | 18 | ✅ |
| `core/markdown/stats.ts` | 11 | ✅ |
| `core/markdown/parser.ts` | 20 | ✅ |
| `core/forest/engine.ts` | 21 | ✅ |
| `components/forest/treeRenderer.ts` | 13 | ✅ |
| **Total** | **83** | ✅ |

## Test Conventions

- Tests live alongside source (`__tests__/`) for unit tests
- Integration tests go in `tests/integration/`
- Test fixtures in `tests/fixtures/`
- Run: `npm test` (vitest run)
- Watch: `npm run test:watch` (vitest)

## TDD Workflow

1. **Red** — Write a failing test in the appropriate `__tests__/` directory
2. **Green** — Write minimal implementation until test passes
3. **Refactor** — Clean up while green
4. **Commit** — `git commit` with test + implementation together

## Future Tests

- Rust unit tests for `vault.rs`, `forest.rs`
- Integration tests for Tauri IPC commands
- Component tests for React components
- E2E tests for full user flows
