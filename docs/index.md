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
| [forest-view-optimizations.md](specs/forest-view-optimizations.md) | 3D 森林待优化清单（缩放、美术、场景） |
| [Forest 3D Optimizations Plan](superpowers/plans/2026-06-13-forest-3d-optimizations.md) | 3D 优化实施计划（当前活跃） |

## 架构 (Architecture)

| 文件 | 说明 |
|------|------|
| [overview.md](architecture/overview.md) | 技术栈、模块结构、数据流、目录结构 |

## 测试 (Testing)

| 文件 | 说明 |
|------|------|
| [testing-strategy.md](testing/testing-strategy.md) | 测试分层、工具、当前覆盖、83 tests |
| [tdd-guide.md](testing/tdd-guide.md) | Red-Green-Refactor 循环 + 命名规范 + ForestNotes 实例 |
| [test-data.md](testing/test-data.md) | 测试数据规范和 fixtures 目录约定 |

## 工作流 (Workflows)

| 文件 | 说明 |
|------|------|
| [pre-pr-workflow.md](workflows/pre-pr-workflow.md) | PR 前完整检查流程：lint → tsc → test → build → cargo（含代码质量/数据安全/MVP 边界检查） |

## AI 开发 (AI Development)

| 文件 | 说明 |
|------|------|
| [coding-rules.md](ai/coding-rules.md) | 编码规范：TypeScript / React / Rust / CSS / Git |
| [context-map.md](ai/context-map.md) | 关键文件索引 — 所有 Rust/TS 模块及职责 |

## 归档 (Archive)

历史设计文档和已执行完毕的计划，保留供参考。

| 文件 | 说明 |
|------|------|
| [claudecode-prompt.md](archive/claudecode-prompt.md) | 项目启动时的 ClaudeCode Prompt（Phase 0 引导） |
| [Canvas Forest Redesign Spec](archive/2026-06-12-canvas-forest-redesign.md) | Canvas 2D 分形树设计（已被 Three.js 3D 方案取代） |
| [Canvas Forest Implementation Plan](archive/2026-06-12-canvas-forest-redesign-plan.md) | Canvas 重设计 5-task 实施计划（已执行完毕） |

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
