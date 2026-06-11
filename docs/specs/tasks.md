# ForestNotes ClaudeCode Task Plan

## 执行规则

ClaudeCode 执行时必须遵守：

1. 先实现 MVP，不要提前实现 AI/RAG、同步、插件系统。
2. Markdown 文件是唯一真实数据源。
3. SQLite 只保存 metadata、索引和统计缓存。
4. 每个阶段完成后必须保证项目可以运行。
5. 每个阶段要有明确验收标准。
6. 核心算法必须写单元测试。
7. 不要一次性生成大量无关代码。
8. 优先保证架构清晰和可维护。

---

# Phase 0: Project Bootstrap

## 目标

创建 ForestNotes 桌面应用基础工程。

## 任务

- 初始化 Tauri 2 + React + TypeScript + Vite 项目。
- 配置 ESLint、Prettier。
- 配置基础路由。
- 创建基础三栏布局。
- 创建空状态页面。
- 创建项目 README。

## 验收标准

- `npm install` 成功。
- `npm run dev` 可以启动前端。
- `npm run tauri dev` 可以启动桌面窗口。
- 页面显示 ForestNotes 基础布局。

---

# Phase 1: Basic Layout

## 目标

实现基础 UI 框架。

## 任务

- 实现 TopBar。
- 实现 FileExplorer 占位组件。
- 实现 MarkdownEditor 占位组件。
- 实现 NoteInfoPanel 占位组件。
- 实现 ForestView 占位页面。
- 实现 SearchPanel 占位组件。
- 实现应用级 Zustand store。

## 验收标准

- 用户可以在 Notes View 和 Forest View 之间切换。
- 三栏布局稳定。
- 没有实际功能也必须有清晰空状态。

---

# Phase 2: Vault Management

## 目标

支持打开本地文件夹作为 vault。

## 任务

- 集成 Tauri dialog plugin。
- 集成 Tauri file system plugin。
- 实现 Open Vault 按钮。
- 保存最近打开的 vault 路径。
- 扫描 vault 下所有 `.md` 文件。
- 忽略隐藏目录和常见构建目录：
  - `.git`
  - `node_modules`
  - `.obsidian`
  - `dist`
  - `build`
- 展示 Markdown 文件树。

## 验收标准

- 用户可以选择一个本地文件夹。
- 系统可以列出该文件夹下所有 `.md` 文件。
- 点击文件树节点可以读取 Markdown 内容。
- 文件路径以 vault 相对路径展示。

---

# Phase 3: Markdown Editor

## 目标

支持读取、编辑、保存 Markdown 文件。

## 任务

- 集成 CodeMirror 6。
- 打开 note 后在编辑器中显示内容。
- 实现保存功能。
- 实现新建笔记。
- 实现重命名笔记。
- 实现删除笔记。
- 添加 unsaved changes 状态。
- 添加保存成功/失败提示。

## 验收标准

- 用户可以创建一篇 `.md` 笔记。
- 用户可以编辑并保存 Markdown 内容。
- 文件系统中的真实 `.md` 文件被更新。
- 保存失败时有错误提示。
- 未保存内容切换文件前有提醒。

---

# Phase 4: Markdown Metadata Parser

## 目标

解析 frontmatter 和 inline tags。

## 任务

- 使用 gray-matter 解析 YAML frontmatter。
- 提取 title。
- 提取 tags。
- 提取 created_at。
- 提取 updated_at。
- 从正文提取 inline tags。
- 实现 tag normalize。
- 实现 word count。
- 实现 content hash。
- 为 parser 写单元测试。

## 验收标准

- 可以正确解析 YAML frontmatter tags。
- 可以正确解析正文中的 `#tag`。
- 可以合并 frontmatter tags 和 inline tags。
- 可以处理 frontmatter 解析失败的情况。
- parser 测试通过。

---

# Phase 5: SQLite Persistence

## 目标

建立 metadata 数据库。

## 任务

- 集成 Tauri SQL plugin。
- 创建 migrations。
- 创建以下表：
  - vaults
  - notes
  - tags
  - note_tags
  - note_activity
  - tag_stats_cache
  - tag_cooccurrence_cache
  - note_links
  - settings
- 实现 Repository 层：
  - VaultRepository
  - NoteRepository
  - TagRepository
  - ActivityRepository
  - SearchRepository
  - ForestRepository
- 实现数据库初始化。

## 验收标准

- 应用启动时可以初始化 SQLite。
- 打开 vault 后可以写入 vault 记录。
- 扫描 Markdown 后可以写入 notes/tags/note_tags。
- 关闭重启应用后 metadata 仍然存在。

---

# Phase 6: Indexing Pipeline

## 目标

实现 vault 扫描和索引构建。

## 任务

- 实现全量索引流程。
- 实现 content_hash 对比。
- 实现新增文件索引。
- 实现修改文件索引。
- 实现删除文件清理。
- 实现手动 Rebuild Index。
- 显示索引进度和错误列表。

## 验收标准

- 打开 vault 后自动建立索引。
- 修改 Markdown 文件后可以重新索引。
- 删除 Markdown 文件后数据库记录同步更新。
- 用户可以手动重建索引。
- 索引错误不会导致整个应用崩溃。

---

# Phase 7: Full-Text Search

## 目标

实现本地全文搜索。

## 任务

- 创建 FTS5 virtual table。
- 索引 title/body/tags。
- 实现 SearchPanel。
- 支持关键词搜索。
- 支持 tag 过滤。
- 支持点击结果打开 note。
- 支持 snippet 高亮。
- 支持按更新时间排序。

## 验收标准

- 可以搜索标题。
- 可以搜索正文。
- 可以搜索 tag。
- 点击搜索结果可以打开对应笔记。
- 修改笔记后搜索结果更新。

---

# Phase 8: Activity Tracking

## 目标

记录阅读和更新行为。

## 任务

- 打开 note 时记录 read activity。
- 保存 note 且内容变化时记录 update activity。
- 新建 note 时记录 create activity。
- 删除 note 时记录 delete activity。
- 更新 notes.read_count。
- 更新 notes.last_read_at。
- 在 NoteInfoPanel 显示 activity summary。

## 验收标准

- 每次打开笔记后 read_count 增加。
- 每次保存变化后 update activity 增加。
- 右侧面板可以看到最近阅读和更新时间。
- Activity 数据参与后续 Forest Engine 计算。

---

# Phase 9: Forest Engine

## 目标

计算森林图数据。

## 任务

- 统计每个 tag 的 noteCount。
- 统计每个 tag 的 readCount30d。
- 统计每个 tag 的 updateCount30d。
- 计算 lastActiveAt。
- 计算 staleDays。
- 计算 health。
- 计算 status。
- 计算 tag co-occurrence。
- 输出 ForestGraph JSON。
- 写单元测试。

## 验收标准

- tag note count 正确。
- co-occurrence 计算正确。
- health 输出在 `[0, 1]`。
- stale/dormant 状态可正确触发。
- ForestGraph 格式稳定。
- 单元测试通过。

---

# Phase 10: Forest View MVP

## 目标

渲染知识森林。

## 任务

- 集成 D3.js。
- 渲染 tag nodes。
- 渲染 co-occurrence edges。
- node size 映射 noteCount。
- node health 映射视觉状态。
- edge width 映射 co-occurrence weight。
- 实现 hover tooltip。
- 实现 click node 选中 tag。
- 右侧展示 tag detail panel。
- 点击相关文章打开 note。

## 验收标准

- tag 文章越多，树节点越大。
- tag 最近活跃越高，树越健康。
- tag 共现越多，边越明显。
- 点击树可以看到相关文章。
- 点击相关文章可以打开 Markdown 笔记。

---

# Phase 11: Polish and MVP Release

## 目标

整理成可用 MVP。

## 任务

- 增加错误边界 ErrorBoundary。
- 增加空状态。
- 增加 loading 状态。
- 增加基础设置页面。
- 增加 Rebuild Index 按钮。
- 增加 sample vault。
- 编写 README 使用说明。
- 修复明显 UI 问题。
- 检查跨平台路径问题。

## 验收标准

- 新用户可以按照 README 启动应用。
- 用户可以打开 sample vault 并看到森林。
- 基础功能闭环完成。
- 没有明显崩溃路径。

---

# Phase 12: Future Extensions

这些不要进入 MVP，但可以预留架构。

## Semantic Search

- note chunking
- embedding
- vector database
- hybrid search
- semantic result ranking

## Local RAG

- ask question
- retrieve related chunks
- answer with citations to notes
- optionally support local model

## Forest Intelligence

- stale knowledge reminders
- isolated tags detection
- tag merge suggestions
- weekly knowledge report

## Advanced Editor

- WYSIWYG Markdown
- block references
- backlinks
- graph view
- templates
