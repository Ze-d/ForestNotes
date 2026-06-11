# ForestNotes Architecture

## 1. 技术栈

建议 MVP 使用：

```text
Desktop Shell: Tauri 2
Frontend: React + TypeScript + Vite
State Management: Zustand
Editor: CodeMirror 6
Visualization: D3.js
Storage: Local Markdown files + SQLite
Search: SQLite FTS5
Parser: gray-matter / unified / remark
```

## 2. 选型理由

### 2.1 Tauri 2

ForestNotes 是本地优先桌面应用，需要访问本地文件系统和本地 SQLite。Tauri 适合用 Web 前端技术构建桌面应用，同时通过后端能力访问系统资源。

### 2.2 React + TypeScript

React + TypeScript 适合快速拆分 UI 组件，也适合 ClaudeCode 逐模块实现。

### 2.3 CodeMirror 6

MVP 阶段不建议做复杂所见即所得编辑器。CodeMirror 更轻量，适合 Markdown 纯文本编辑。

### 2.4 SQLite

SQLite 用于：

- 笔记 metadata 缓存
- tag 关系
- 阅读/更新 activity
- 全文搜索索引
- forest graph 缓存

不用于保存 Markdown 正文的唯一数据源。

### 2.5 D3.js

Forest View 本质是 tag 节点和 tag 共现边组成的图。D3 force layout 适合实现节点布局、碰撞检测和边权重可视化。

## 3. 总体架构

```text
ForestNotes
├── Tauri Desktop Shell
│   ├── File System Access
│   ├── SQLite Access
│   └── Native Dialogs
│
├── React Frontend
│   ├── Layout
│   ├── File Explorer
│   ├── Markdown Editor
│   ├── Preview
│   ├── Search Panel
│   ├── Tag Panel
│   └── Forest View
│
├── Core Domain Layer
│   ├── Vault Service
│   ├── Note Service
│   ├── Markdown Parser
│   ├── Tag Service
│   ├── Activity Service
│   ├── Search Service
│   └── Forest Engine
│
├── Persistence Layer
│   ├── Markdown Files
│   ├── SQLite Metadata DB
│   └── SQLite FTS5 Index
│
└── Future AI Layer
    ├── Chunker
    ├── Embedding Service
    ├── Vector Store
    └── Local RAG
```

## 4. 数据流

### 4.1 Vault 扫描流

```text
User selects vault folder
↓
VaultService scans .md files
↓
NoteService reads files
↓
MarkdownParser extracts frontmatter, body, inline tags
↓
TagService normalizes tags
↓
Database upserts notes, tags, note_tags
↓
SearchService updates FTS index
↓
ForestEngine computes tag stats and co-occurrence graph
↓
Frontend refreshes File Explorer, Search, Forest View
```

### 4.2 笔记保存流

```text
User edits note
↓
Editor emits content
↓
NoteService writes .md file
↓
Compute content hash
↓
If changed:
  - update note.updated_at
  - insert activity(type='update')
  - reparse tags
  - update FTS index
  - recompute impacted forest metrics
```

### 4.3 笔记阅读流

```text
User opens note
↓
NoteService marks note as read
↓
ActivityService inserts activity(type='read')
↓
notes.read_count += 1
↓
notes.last_read_at = now
↓
ForestEngine updates tag health
```

## 5. 推荐目录结构

```text
forest-notes/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.tsx
│   │   └── providers.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   ├── editor/
│   │   ├── explorer/
│   │   ├── search/
│   │   ├── tags/
│   │   └── forest/
│   │
│   ├── features/
│   │   ├── vault/
│   │   ├── notes/
│   │   ├── tags/
│   │   ├── search/
│   │   ├── activity/
│   │   └── forest/
│   │
│   ├── core/
│   │   ├── markdown/
│   │   ├── ids/
│   │   ├── time/
│   │   └── hashing/
│   │
│   ├── db/
│   │   ├── client.ts
│   │   ├── migrations/
│   │   ├── repositories/
│   │   └── schema.ts
│   │
│   ├── stores/
│   │   ├── vaultStore.ts
│   │   ├── noteStore.ts
│   │   └── forestStore.ts
│   │
│   └── types/
│       ├── note.ts
│       ├── tag.ts
│       ├── activity.ts
│       └── forest.ts
│
├── src-tauri/
│   ├── src/
│   ├── capabilities/
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── docs/
├── package.json
└── README.md
```

## 6. 核心类型设计

### 6.1 Note

```ts
export interface Note {
  id: string;
  path: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastReadAt?: string;
  readCount: number;
  wordCount: number;
}
```

### 6.2 Tag

```ts
export interface Tag {
  id: string;
  name: string;
  noteCount: number;
  readCount30d: number;
  updateCount30d: number;
  lastActiveAt?: string;
  health: number;
  status: "healthy" | "normal" | "stale" | "dormant";
}
```

### 6.3 ForestNode

```ts
export interface ForestNode {
  id: string;
  label: string;
  noteCount: number;
  health: number;
  status: "healthy" | "normal" | "stale" | "dormant";
  size: number;
  x?: number;
  y?: number;
}
```

### 6.4 ForestEdge

```ts
export interface ForestEdge {
  source: string;
  target: string;
  weight: number;
}
```

### 6.5 ForestGraph

```ts
export interface ForestGraph {
  nodes: ForestNode[];
  edges: ForestEdge[];
  generatedAt: string;
}
```

## 7. 关键工程原则

### 7.1 Repository Pattern

前端业务模块不要直接写 SQL。统一通过 repository 层访问数据库。

```text
Feature Service
↓
Repository
↓
SQLite client
```

### 7.2 Incremental Indexing

不要每次保存都全量重建所有索引。

MVP 可以先全量重建，等功能稳定后再优化为：

- 根据 content_hash 判断文件是否变化。
- 只重新解析变化文件。
- 只更新受影响 tags 的统计。
- 定期重建 co-occurrence cache。

### 7.3 可测试性

核心算法要从 UI 中剥离。

至少为以下模块写单元测试：

- frontmatter parser
- inline tag extractor
- tag normalizer
- co-occurrence calculator
- health calculator
- forest graph builder

### 7.4 错误处理

必须处理：

- vault 路径不存在
- Markdown 文件读取失败
- frontmatter 格式错误
- tags 不是数组
- 文件重命名导致 path 变化
- SQLite 初始化失败
- FTS index 重建失败

## 8. 后续扩展架构

### 8.1 Phase 2: Semantic Search

```text
Markdown note
↓
Chunker
↓
Embedding model
↓
Vector store
↓
Semantic Search UI
```

### 8.2 Phase 3: Local RAG

```text
User question
↓
Hybrid search: FTS + vector search
↓
Top-k chunks
↓
Local or remote LLM
↓
Answer with source notes
```

### 8.3 Phase 4: Forest Intelligence

未来可以根据森林自动生成建议：

- 哪些 tag 过于孤立
- 哪些主题长期未复习
- 哪些 tag 正在形成新的知识群落
- 哪些笔记适合合并
- 哪些 tag 适合重命名
