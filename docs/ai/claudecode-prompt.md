# ClaudeCode Start Prompt for ForestNotes

你现在要帮助我开发一个桌面端 local-first Markdown 笔记软件，项目名称是 ForestNotes。

请严格按照当前仓库中的文档执行：

1. `PROJECT_SPEC.md`
2. `ARCHITECTURE.md`
3. `DATABASE_SCHEMA.md`
4. `FOREST_ENGINE.md`
5. `TASKS.md`

## 项目目标

ForestNotes 是一个类似 Obsidian 的本地 Markdown 笔记软件，但它的核心亮点不是普通 graph view，而是 Knowledge Forest：

- 每个 tag 是一棵树。
- 拥有该 tag 的文章越多，树越大。
- 拥有该 tag 的文章最近被阅读或更新越多，树越健康。
- 两个 tag 共同出现在文章中的次数越多，两棵树之间的藤蔓/连接越强。
- 长期未阅读、未更新的 tag 会进入 stale 或 dormant 状态。

第二个亮点是本地知识库管理：

- MVP 阶段先做 SQLite FTS5 全文搜索。
- 后续再扩展语义搜索和本地 RAG。
- MVP 不要实现 AI 问答。

## 技术栈要求

请使用：

```text
Tauri 2
React
TypeScript
Vite
Zustand
CodeMirror 6
D3.js
SQLite
SQLite FTS5
```

如果你认为需要替换某个库，必须先说明原因，不要直接重构技术栈。

## 最重要的架构原则

```text
Markdown 文件是唯一真实数据源。
SQLite 只是 metadata、索引和统计缓存。
```

这意味着：

- 笔记正文必须保存到 `.md` 文件。
- SQLite 可以保存搜索索引、tag 统计、阅读次数、更新时间、co-occurrence 缓存。
- 如果 SQLite 删除，应用应该可以通过重新扫描 vault 重建索引。
- 不要把 SQLite 设计成笔记内容的唯一存储位置。

## MVP 不做

请不要在 MVP 中实现：

- 云同步
- 账号登录
- 插件系统
- 移动端
- 3D 森林
- AI 问答
- 向量数据库
- 多人协作
- Obsidian 插件兼容
- 复杂块编辑器

## 执行方式

请按 `TASKS.md` 中的 Phase 顺序执行。

每完成一个 Phase，请：

1. 总结完成内容。
2. 列出新增/修改文件。
3. 说明如何运行和验证。
4. 说明是否有未解决问题。
5. 不要跳过测试。
6. 不要一次性实现后续阶段功能。

## 当前第一步

请先执行：

```text
Phase 0: Project Bootstrap
```

目标：

- 初始化 Tauri 2 + React + TypeScript + Vite 项目。
- 配置基础三栏布局。
- 确保 `npm run tauri dev` 可以启动应用。
- 不要实现复杂业务逻辑。

请先检查当前仓库状态，然后给出执行计划，再开始修改代码。
