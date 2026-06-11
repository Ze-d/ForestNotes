# AGENTS.md — ForestNotes

AI assistant instructions for this project.

## Core Principles

1. **Markdown files are the single source of truth.** SQLite is cache/index only.
2. **TDD**: Write tests first for core logic. Verify they fail, then implement.
3. **SDD**: Spec → Design → Tasks → Implementation. Follow docs/specs/ order.
4. **MVP first**: Don't implement Phase 12 features (AI/RAG/sync/plugins) before MVP complete.

## Workflow

- Before non-trivial changes, read `docs/specs/product-spec.md` and `docs/specs/tasks.md`.
- Follow `docs/testing/tdd-guide.md` for test-first development.
- Core algorithms (parser, forest engine) must have unit tests.
- Run `npm test` before claiming completion.

## Code Conventions

- Rust: `src-tauri/src/` — repository pattern, one module per domain.
- TypeScript: `src/` — components/features/stores/core/db separation.
- Use barrel exports (`index.ts`) for clean imports.
- Prefer `const` over `let`. No `any` without justification.

## Project Structure

```
forest-notes/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components by domain
│   ├── features/           # Feature-specific API wrappers
│   ├── core/               # Pure domain logic (markdown, forest)
│   ├── db/                 # Database client (Tauri invoke wrappers)
│   ├── stores/             # Zustand state management
│   └── types/              # Shared TypeScript types
├── src-tauri/              # Rust backend (Tauri 2)
│   └── src/
│       ├── db/             # SQLite module (connection, repos, commands)
│       ├── vault.rs        # File system operations
│       └── forest.rs       # Forest graph computation
├── tests/                  # Additional test infrastructure
├── docs/                   # SDD documentation
│   ├── specs/              # Product & technical specifications
│   ├── architecture/       # Architecture & design decisions
│   ├── testing/            # Testing strategy & guides
│   └── ai/                 # AI assistant prompts & checklists
└── sample-vault/           # Demo vault with tagged notes
```
