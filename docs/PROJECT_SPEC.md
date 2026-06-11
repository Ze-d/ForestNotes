# ForestNotes Product Spec

## 1. 产品定位

ForestNotes 是一款 local-first Markdown 笔记软件。它保留本地 Markdown 文件的开放性，同时用“知识森林”展示用户的知识结构、知识活跃度和 tag 之间的关联关系。

一句话定义：

> ForestNotes turns a local Markdown vault into a living knowledge forest.

## 2. 核心差异化

ForestNotes 不以完整复刻 Obsidian 为目标，而是围绕两个核心差异化能力构建 MVP：

### 2.1 Knowledge Forest

每个 tag 映射为一棵树。

- 拥有该 tag 的文章越多，树越大。
- 拥有该 tag 的文章最近被阅读或更新越多，树越健康。
- 两个 tag 在同一篇文章中共同出现次数越多，两棵树之间的连接越强。
- 长期未阅读、未更新的 tag 区域会变黄、枯萎或进入 dormant 状态。

### 2.2 Local Knowledge Base

ForestNotes 将本地 Markdown vault 管理为本地知识库。

MVP 阶段：

- 标题搜索
- 正文全文搜索
- tag 过滤
- 最近更新排序
- 最近阅读排序
- 从 Forest View 跳转到相关文章

后续阶段：

- chunking
- embedding
- semantic search
- local RAG
- note-based Q&A

## 3. 目标用户

### 3.1 知识管理用户

用户已经有大量 Markdown 笔记，希望看到自己的知识结构，而不只是文件夹和列表。

### 3.2 学生 / 研究者

用户需要长期积累论文、课程、实验、项目文档，希望看到哪些主题积累充分，哪些主题长期未复习。

### 3.3 开发者 / Vibe Coding 用户

用户希望将项目文档、prompt、设计文档、实验记录统一存储成本地知识库，并快速检索。

## 4. MVP 范围

### 4.1 必须支持

- 打开本地文件夹作为 vault。
- 扫描 vault 中的 `.md` 文件。
- 创建 Markdown 笔记。
- 编辑 Markdown 笔记。
- 保存 Markdown 文件。
- 从 YAML frontmatter 提取 `title` 和 `tags`。
- 从正文提取 inline tags，例如 `#AI`、`#Transformer`。
- 将 notes、tags、note_tags、activity 写入 SQLite。
- 建立本地全文搜索索引。
- 展示 tag 统计。
- 生成 Forest View。
- 点击树节点后展示该 tag 下的文章。
- 记录笔记阅读事件。
- 记录笔记更新事件。
- 根据 tag 文章数、阅读次数、更新时间计算树大小和健康度。
- 根据 tag 共现次数绘制连接关系。

### 4.2 MVP 暂不支持

- 多端同步
- 账号系统
- 云端存储
- 插件系统
- Obsidian 插件兼容
- 所见即所得块编辑器
- 实时协作
- 移动端
- 3D 森林
- AI 问答
- 向量数据库
- 自动总结

## 5. 产品核心原则

### 5.1 Markdown 是唯一真实数据源

所有笔记内容必须保存为 `.md` 文件。

SQLite 不是内容源，只是缓存、索引和统计层。

```text
Markdown files = source of truth
SQLite = metadata / index / cache
Forest View = visualization layer
AI / RAG = optional intelligence layer
```

### 5.2 用户数据可迁移

即使 ForestNotes 损坏，用户仍然可以用 VS Code、Obsidian、Typora 等工具打开 Markdown 文件。

### 5.3 本地优先

MVP 不依赖云端服务，不要求登录，不上传用户笔记内容。

## 6. 核心用户流程

### 6.1 打开 vault

```text
用户点击 Open Vault
↓
选择本地文件夹
↓
系统扫描所有 .md 文件
↓
解析 metadata
↓
写入 SQLite
↓
刷新文件树、搜索索引、Forest View
```

### 6.2 创建笔记

```text
用户点击 New Note
↓
输入标题
↓
系统创建 Markdown 文件
↓
写入默认 frontmatter
↓
打开编辑器
↓
保存后更新 SQLite index
```

默认 frontmatter：

```yaml
---
title: Untitled
tags: []
created_at: 2026-06-10T00:00:00+09:00
updated_at: 2026-06-10T00:00:00+09:00
---
```

### 6.3 编辑笔记

```text
用户选择笔记
↓
编辑 Markdown 内容
↓
保存文件
↓
计算 content_hash
↓
如果内容变化，记录 update activity
↓
重新解析 tags
↓
更新 SQLite
↓
更新搜索索引
↓
更新 Forest View
```

### 6.4 阅读笔记

```text
用户打开一篇笔记
↓
系统记录 read activity
↓
更新 note.last_read_at 和 read_count
↓
影响对应 tags 的 health
↓
Forest View 中相关树木变得更健康
```

### 6.5 查看森林

```text
用户进入 Forest View
↓
系统加载 forest graph JSON
↓
按 tag note count 渲染树大小
↓
按 tag health 渲染健康度
↓
按 tag co-occurrence 渲染藤蔓连接
↓
用户点击树
↓
右侧展示该 tag 下的文章列表
```

## 7. 信息架构

建议 MVP 主界面：

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Bar: Vault name / Search / Forest Toggle / Settings      │
├───────────────┬─────────────────────────┬───────────────────┤
│ File Explorer │ Markdown Editor/Preview │ Note Info Panel   │
│               │                         │ - title           │
│ - folders     │                         │ - tags            │
│ - notes       │                         │ - backlinks       │
│ - tags        │                         │ - activity        │
│               │                         │ - related notes   │
├───────────────┴─────────────────────────┴───────────────────┤
│ Optional bottom panel: Search results / Forest mini panel     │
└─────────────────────────────────────────────────────────────┘
```

Forest View 可以作为一个独立页面：

```text
┌─────────────────────────────────────────────────────────────┐
│ Forest Toolbar: filter / time range / layout / health mode   │
├───────────────────────────────────────────┬─────────────────┤
│ Forest Canvas                             │ Tag Detail Panel │
│ - trees                                   │ - note count     │
│ - vines                                   │ - health         │
│ - clusters                                │ - related tags   │
│                                           │ - related notes  │
└───────────────────────────────────────────┴─────────────────┘
```

## 8. 验收标准

MVP 完成后，用户应该能够：

- 打开一个包含 Markdown 文件的本地文件夹。
- 在 ForestNotes 中看到 Markdown 文件列表。
- 创建、编辑、保存一篇 Markdown 笔记。
- 给笔记添加 tags。
- 搜索笔记标题和正文。
- 看到 tag 列表和每个 tag 的文章数。
- 看到一片由 tags 生成的森林。
- 看到文章多的 tag 树更大。
- 看到近期阅读/更新多的 tag 树更健康。
- 看到经常共同出现的 tags 之间有连接。
- 点击一棵树后看到该 tag 下的相关文章。
