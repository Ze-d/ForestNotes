# 🌳 ForestNotes

A local-first Markdown note-taking app that turns your knowledge into a living forest.

## What is ForestNotes?

ForestNotes transforms a local Markdown vault into an interactive **Knowledge Forest**:

- Each **tag** is a **tree** — more notes = bigger tree
- Active tags (recently read/updated) stay **green and healthy**
- Neglected tags slowly turn **yellow → gray → dormant**
- Tags that appear together grow **vines** between their trees

All notes stay as plain `.md` files — open them with any editor. ForestNotes adds search, visualization, and metadata on top.

## Features (MVP)

| Feature | Status |
|---------|--------|
| Open local folder as vault | ✅ |
| Create / edit / save Markdown notes | ✅ |
| YAML frontmatter parsing (title, tags, dates) | ✅ |
| Inline `#tag` extraction | ✅ |
| Full-text search (FTS5) | ✅ |
| Tag filtering | ✅ |
| Knowledge Forest (D3 force graph) | ✅ |
| Activity tracking (reads, updates) | ✅ |
| Incremental indexing (content hash) | ✅ |
| Light / dark mode (auto-detect) | ✅ |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri 2 |
| Frontend | React 19 + TypeScript + Vite |
| State | Zustand |
| Editor | CodeMirror 6 |
| Visualization | D3.js |
| Database | SQLite + FTS5 (via rusqlite) |
| Parsing | gray-matter |

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Rust** 1.77+
- [Tauri 2 system dependencies](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
# Install dependencies
npm install

# Start Vite dev server (frontend only, no Tauri APIs)
npm run dev

# Start Tauri dev (full desktop app)
npm run tauri dev

# Run unit tests
npm test

# Build for production
npm run tauri build
```

### Try the Sample Vault

The `sample-vault/` directory contains example notes with tags:

```
sample-vault/
├── Welcome to ForestNotes.md
├── AI and Machine Learning.md
├── Transformer Architecture.md
├── Retrieval Augmented Generation RAG.md
├── Build a Second Brain.md
└── TypeScript Best Practices.md
```

Open it in ForestNotes to see the Knowledge Forest with:
- **6 notes** across topics: AI, programming, productivity
- **15 tags**: AI, Transformer, LLM, RAG, machine-learning, deep-learning, typescript, etc.
- Healthy tag clusters: AI ↔ Transformer ↔ LLM ↔ RAG ↔ deep-learning

### Quick Start Flow

1. Launch the app
2. Click **📂 Open** in the sidebar
3. Select the `sample-vault/` folder (or any folder with `.md` files)
4. Browse notes in the **Notes** view
5. Switch to **Forest** view to see your knowledge landscape
6. Click a tree to see tag details
7. Use the search bar (or press **Enter**) to find notes

## Architecture

```
Markdown files (source of truth)
    ↕ read/write
Tauri Rust backend
    ├── File system: scan/read/write .md
    └── SQLite: metadata cache + FTS5 search
    ↕ Tauri commands (IPC)
React frontend
    ├── Notes view: three-column layout
    ├── Forest view: D3 force-directed graph
    ├── Search: full-text with highlighted snippets
    └── Settings: vault management + rebuild index
```

## Core Principle

> **Markdown files are the single source of truth.**
> SQLite is only for metadata, search index, and caching.

If the database is deleted, ForestNotes can rebuild it by re-scanning your vault.

## License

MIT
