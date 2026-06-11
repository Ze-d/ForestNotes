# ForestNotes 项目文档包

ForestNotes 是一个 local-first Markdown 笔记软件，核心亮点是：

1. 根据文章 tags、tag 共现次数、阅读次数、更新时间生成“知识森林”。
2. 将本地 Markdown vault 管理成本地知识库，先支持全文搜索，后续扩展语义检索与本地 RAG。

建议 ClaudeCode 按以下顺序阅读并执行：

1. `PROJECT_SPEC.md`：产品规格与 MVP 边界
2. `ARCHITECTURE.md`：技术架构与模块划分
3. `DATABASE_SCHEMA.md`：SQLite 数据库与索引设计
4. `FOREST_ENGINE.md`：森林指标、算法和可视化映射
5. `TASKS.md`：分阶段开发任务与验收标准
6. `CLAUDECODE_PROMPT.md`：可以直接复制给 ClaudeCode 的启动 Prompt

## 核心原则

- Markdown 文件是唯一真实数据源。
- SQLite 只作为 metadata、搜索索引和统计缓存。
- Forest View 是 tag 生态的可视化层。
- AI/RAG 是后续增强层，不进入 MVP 强依赖。
