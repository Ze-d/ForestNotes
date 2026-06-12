# ForestNotes Documentation

## 项目入口

| 文件 | 说明 |
|------|------|
| [../README.md](../README.md) | 项目概述、技术栈、快速开始 |
| [../AGENTS.md](../AGENTS.md) | AI 助手行为约定（原则、工作流、代码规范） |

---

## 规格说明 (Specifications)

| 文件 | 说明 |
|------|------|
| [product-spec.md](specs/product-spec.md) | 产品规格：定位、差异化、MVP 范围、用户流程、信息架构、验收标准 |
| [database-schema.md](specs/database-schema.md) | 数据库设计：9 张表 + FTS5 + 6 个索引、重建策略、tag 规范化 |
| [forest-engine.md](specs/forest-engine.md) | Forest Engine 算法：树大小/健康度/状态分类/共现/可视化映射 |
| [tasks.md](specs/tasks.md) | 分阶段任务计划 (Phase 0–12)，含验收标准 |

## 设计文档 (Design)

| 文件 | 说明 |
|------|------|
| [Canvas Forest Redesign Spec](superpowers/specs/2026-06-12-canvas-forest-redesign.md) | Canvas 分形树 → Three.js 3D 悬浮岛设计演进 |
| [Canvas Forest Implementation Plan](superpowers/plans/2026-06-12-canvas-forest-redesign.md) | 原 Canvas 重设计的 5-task 实施计划（已执行完毕） |
| [Forest View Optimizations](specs/forest-view-optimizations.md) | 3D 森林待优化清单（缩放、美术、场景） |

## 架构 (Architecture)

| 文件 | 说明 |
|------|------|
| [overview.md](architecture/overview.md) | 技术栈、模块结构、数据流、目录结构 |
| [adr/](architecture/adr/) | 架构决策记录（待填充） |

## 测试 (Testing)

| 文件 | 说明 |
|------|------|
| [testing-strategy.md](testing/testing-strategy.md) | 测试分层、工具、当前覆盖、70+ tests |
| [tdd-guide.md](testing/tdd-guide.md) | Red-Green-Refactor 循环 + 命名规范 + ForestNotes 实例 |
| [test-data.md](testing/test-data.md) | 测试数据规范和 fixtures 目录约定 |

## AI 开发 (AI Development)

| 文件 | 说明 |
|------|------|
| [claudecode-prompt.md](ai/claudecode-prompt.md) | ClaudeCode 启动 Prompt — 项目目标、技术栈、架构原则 |
| [coding-rules.md](ai/coding-rules.md) | 编码规范：TypeScript/React/Rust/CSS/Git |
| [context-map.md](ai/context-map.md) | 关键文件索引 — 所有 Rust/TS 模块及职责 |
| [review-checklist.md](ai/review-checklist.md) | 提交前/合并前检查清单 |

---

## 演示数据 (Sample Vault)

[sample-vault/](../sample-vault/) — 11 个带 tag 的 Markdown 笔记，用于演示 Forest View 效果。

| 文件 | Tags |
|------|------|
| [README.md](../sample-vault/README.md) | 使用说明 + 预期森林效果 |
| Welcome to ForestNotes.md | forestnotes, getting-started |
| AI and Machine Learning.md | AI, machine-learning, deep-learning, Transformer, LLM |
| Transformer Architecture.md | Transformer, AI, deep-learning, LLM |
| Retrieval Augmented Generation RAG.md | RAG, AI, LLM, search |
| LLM Applications.md | LLM, AI, RAG, prompt-engineering |
| Prompt Engineering Techniques.md | prompt-engineering, LLM, AI, productivity |
| Build a Second Brain.md | productivity, note-taking, knowledge-management |
| Note-taking Tools Comparison.md | note-taking, productivity, knowledge-management, markdown |
| React and TypeScript Setup.md | react, typescript, web-development, programming |
| TypeScript Best Practices.md | typescript, programming, web-development |

---

## 文档统计

```
类型           数量
────────────────────
入口文档        2   (README.md, AGENTS.md)
规格说明        4   (product, database, forest-engine, tasks)
设计文档        3   (canvas-redesign ×2, optimizations)
架构文档        1   (overview)
测试文档        3   (strategy, tdd-guide, test-data)
AI 开发文档      4   (prompt, rules, context-map, checklist)
演示数据       11   (sample-vault notes + README)
总计           28
```
