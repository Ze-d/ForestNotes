# ForestNotes Forest Engine

## 1. 目标

Forest Engine 将 notes、tags、activity 和 co-occurrence 数据转换为 Forest View 可渲染的 graph JSON。

输入：

```text
notes
tags
note_tags
note_activity
```

输出：

```ts
interface ForestGraph {
  nodes: ForestNode[];
  edges: ForestEdge[];
  generatedAt: string;
}
```

## 2. 核心映射关系

| 知识数据 | 森林视觉 |
|---|---|
| tag | 一棵树 |
| tag 下文章数量 | 树大小 |
| tag 最近阅读/更新活跃度 | 树健康度 |
| tag 长期未活动 | 树枯萎程度 |
| tag 共现次数 | 树之间的藤蔓/路径 |
| tag 社群 | 一片树林 |
| 孤立 tag | 独立树 |
| 高活跃 tag | 更绿、更饱满 |
| 低活跃 tag | 更黄、更稀疏 |

## 3. 指标定义

### 3.1 noteCount

```text
noteCount(tag) = count(notes that contain tag)
```

### 3.2 readCount30d

```text
readCount30d(tag) = count(read activities for notes that contain tag in last 30 days)
```

### 3.3 updateCount30d

```text
updateCount30d(tag) = count(update activities for notes that contain tag in last 30 days)
```

### 3.4 lastActiveAt

```text
lastActiveAt(tag) = max(activity.created_at for notes that contain tag)
```

如果没有 activity，则使用该 tag 下 notes 的最大 `updated_at`。

### 3.5 staleDays

```text
staleDays(tag) = daysBetween(now, lastActiveAt(tag))
```

### 3.6 coOccurrence

```text
coOccurrence(tagA, tagB) = count(notes that contain both tagA and tagB)
```

## 4. 树大小算法

不要线性映射，因为大 tag 会压制小 tag。

建议：

```ts
function computeTreeSize(noteCount: number): number {
  return Math.log1p(noteCount);
}
```

进一步可映射到像素：

```ts
function mapTreeRadius(noteCount: number): number {
  const minRadius = 16;
  const maxRadius = 72;
  const size = Math.log1p(noteCount);
  const maxSize = Math.log1p(100);
  return minRadius + (size / maxSize) * (maxRadius - minRadius);
}
```

## 5. 健康度算法

MVP 使用简单、可解释的公式。

```ts
function computeHealth(params: {
  readCount30d: number;
  updateCount30d: number;
  staleDays: number;
}): number {
  const activityScore =
    0.6 * Math.log1p(params.readCount30d) +
    0.4 * Math.log1p(params.updateCount30d);

  const decay = Math.exp(-params.staleDays / 90);

  const raw = activityScore * decay;

  return clamp(raw / 3, 0, 1);
}
```

说明：

- 阅读代表知识被调用，权重较高。
- 更新代表知识被维护，权重也重要。
- `staleDays` 使用指数衰减，避免突然从健康变枯萎。
- 输出范围 `[0, 1]`。

## 6. 状态分类

```ts
function getTreeStatus(health: number, staleDays: number): TreeStatus {
  if (staleDays >= 180) return "dormant";
  if (staleDays >= 90) return "stale";
  if (health >= 0.65) return "healthy";
  return "normal";
}
```

状态说明：

| status | 条件 | 视觉 |
|---|---|---|
| healthy | health >= 0.65 且 staleDays < 90 | 绿色、饱满 |
| normal | 默认状态 | 正常 |
| stale | staleDays >= 90 | 偏黄、稀疏 |
| dormant | staleDays >= 180 | 枯萎、落叶 |

## 7. tag 共现算法

对于每篇笔记，取该笔记所有 tags 的组合。

示例：

```text
note tags = [AI, Transformer, RAG]
```

产生：

```text
AI - Transformer
AI - RAG
Transformer - RAG
```

TypeScript 示例：

```ts
function buildCoOccurrence(tagsByNote: string[][]): Map<string, number> {
  const edgeCount = new Map<string, number>();

  for (const tags of tagsByNote) {
    const uniqueTags = Array.from(new Set(tags)).sort();

    for (let i = 0; i < uniqueTags.length; i++) {
      for (let j = i + 1; j < uniqueTags.length; j++) {
        const key = `${uniqueTags[i]}::${uniqueTags[j]}`;
        edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      }
    }
  }

  return edgeCount;
}
```

## 8. Forest Graph 输出格式

```json
{
  "nodes": [
    {
      "id": "ai",
      "label": "AI",
      "noteCount": 42,
      "health": 0.91,
      "status": "healthy",
      "size": 3.76
    }
  ],
  "edges": [
    {
      "source": "ai",
      "target": "transformer",
      "weight": 12
    }
  ],
  "generatedAt": "2026-06-10T17:30:00+09:00"
}
```

## 9. 可视化规则

### 9.1 节点

每个节点是一棵树。

MVP 可以先用简单 SVG 图形代替复杂树模型：

```text
circle / tree icon / emoji-style SVG
```

建议视觉映射：

```text
radius = mapTreeRadius(noteCount)
opacity = 0.5 + 0.5 * health
status controls fill style
```

### 9.2 边

每条边是一条藤蔓或路径。

```text
strokeWidth = 1 + log1p(weight)
opacity = min(0.8, 0.15 + weight / 20)
```

### 9.3 布局

MVP 使用 force-directed layout：

```text
node force: tag nodes
link force: co-occurrence edges
charge force: avoid overlap
collision force: based on tree radius
center force: keep forest centered
```

强共现边应该让两棵树更近。

```ts
linkDistance = max(40, 220 - weight * 12)
```

### 9.4 交互

必须支持：

- hover tree：显示 tag name、note count、health、last active。
- click tree：选中 tag，右侧展示相关文章。
- click edge：显示两个 tag 的共现文章。
- filter：按 health/status/noteCount 过滤。
- time range：后续支持 7d/30d/90d/all。

## 10. Forest Detail Panel

点击 tag 后展示：

```text
Tag: AI
Note count: 42
Health: 0.91
Status: Healthy
Last active: 2026-06-09
Related tags:
  - Transformer: 12
  - RAG: 9
  - Agent: 7
Notes:
  - Transformer 笔记
  - RAG 系统设计
  - Agent 工程实践
```

## 11. 计算策略

### 11.1 MVP

MVP 可以在以下时机全量计算：

- vault 首次打开
- 手动点击 Rebuild Index
- 保存笔记后 debounce 1 秒重新计算

### 11.2 后续优化

后续改为增量计算：

- 只更新受影响 note 的 tags。
- 只更新新增/删除 tag pair 的 co-occurrence。
- 使用 tag_stats_cache 和 tag_cooccurrence_cache 缓存结果。

## 12. 可测试样例

### 输入

```text
note1 tags: [AI, Transformer]
note2 tags: [AI, RAG]
note3 tags: [AI, Transformer, LLM]
```

### 期望 tag count

```text
AI: 3
Transformer: 2
RAG: 1
LLM: 1
```

### 期望 co-occurrence

```text
AI - Transformer: 2
AI - RAG: 1
AI - LLM: 1
Transformer - LLM: 1
```

## 13. MVP 视觉建议

第一版不要追求游戏级森林。

建议先实现：

```text
graph nodes + tree-like icons + health color + edge vines
```

后续再升级：

- 更真实树木
- 森林地形
- 季节变化
- 知识群落
- 复习提醒
- tag 重构建议
