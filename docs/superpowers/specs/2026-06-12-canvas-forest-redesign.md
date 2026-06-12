# Canvas 有机森林重设计

## 目标

将 Forest View 从 D3 SVG 力导向图（圆节点 + 直线连线）改为 **Canvas 绘制的有机形森林**（分形树 + 藤蔓曲线 + 草坪地面）。

## 动机

用户期望看到"树的形状的森林"，而非当前的知识图谱风格。核心隐喻是：tag → 一棵树，而非一颗球。

## 方案选择

选型：**纯 Canvas + HTML 浮层**（方案 C）

| 方案 | 描述 | 采纳？ |
|------|------|--------|
| A. 纯 Canvas + d3-force | Canvas 全部渲染，d3-force 仅布局 | ❌ |
| B. Canvas 树 + SVG 藤蔓 | 双层混合渲染 | ❌ |
| **C. 纯 Canvas + HTML 浮层** | Canvas 画树+藤蔓+草坪，HTML div 做 tooltip/detail | ✅ |

理由：单层渲染坐标系统一、性能最优、有机感完整。

## 架构

```
ForestView (React)
  ├── ForestToolbar (filter + refresh + stats)
  ├── [Canvas] ForestCanvas                    ← 重写
  │     ├── renderGround()    草坪
  │     ├── renderVines()     贝塞尔藤蔓曲线
  │     ├── renderTree()      分形递归树 (每棵树)
  │     └── hitTest()         点击/悬停检测
  │
  ├── [HTML] Tooltip div      跟随鼠标
  │
  └── ForestDetailPanel       右侧 tag 详情 (不变)

d3-force (仅布局计算，不渲染):
  └── forceSimulation(nodes, edges)
       ├── nodes.x, nodes.y       树的位置
       ├── forceLink(edges)       藤蔓拉扯
       ├── forceManyBody(-400)    排斥力
       ├── forceCollide(crownRadius+12) 碰撞检测
       ├── forceCenter, forceX, forceY
       └── tick → Canvas redraw
```

## 分形树渲染算法

### 参数映射

| 数据 | 分形参数 | 范围 |
|------|---------|------|
| `noteCount` | 递归深度 | 2-8 层 |
| `noteCount` | 一级分支数 | 2-5 个 |
| `health` | 叶子颜色 | 翠绿 → 枯黄 |
| `status` | 落叶量 | healthy=满叶, stale=稀疏, dormant=光秃 |
| 随机种子 (hash of tag id) | 分支角度、扭曲 | 每树不同 |

### 递归规则

```
drawBranch(ctx, x, y, length, angle, depth, maxDepth):
  if depth == 0: return
  
  // 计算终点
  endX = x + sin(angle) * length
  endY = y - cos(angle) * length
  
  // 画树枝
  strokeWidth = depth / maxDepth * baseWidth
  ctx.line(endX, endY)
  
  // 末端画叶子
  if depth == 1:
    drawLeaf(ctx, endX, endY, health, status)
  
  // 递归子枝
  for each sub-branch (2-3 个):
    newAngle = angle + random(-15°, 35°)  // 含随机种子
    newLength = length * (0.6 ~ 0.7)
    drawBranch(ctx, endX, endY, newLength, newAngle, depth-1, maxDepth)
```

### 叶子绘制

- 椭圆或点簇，颜色由 `health` 映射
- healthy → `#2f9e44` (翠绿)
- normal → `#74b816`
- stale → `#f59f00` (枯黄，稀疏)
- dormant → 无叶，灰色枯枝

### 小树处理 (noteCount ≤ 2)

- 递归深度 1-2 层
- 主干稍粗 (保证可见)
- 叶子稍大
- 树高 ≥ 30px

### 树冠半径（碰撞检测用）

```
crownRadius = 25 + noteCount * 7     (约 32~130px)
```

## 藤蔓渲染

### 曲线类型

贝塞尔二次曲线，从树冠边缘 → 树冠边缘：

```
sourceEdge = 树A中心 + 方向向量 * crownRadius_A
targetEdge = 树B中心 + 方向向量 * crownRadius_B
controlPoint = 中点 + 垂直偏移 (让曲线有弧度)
```

### 样式

- 线宽 = `1 + log1p(weight)`
- 透明度 = `min(0.6, 0.1 + weight / 20)`
- 颜色从 A 树健康色渐变到 B 树健康色

## 草坪地面

- Canvas 底部 ~80px 高度
- 使用多条贝塞尔曲线模拟起伏地形
- 填充渐变：深绿 (底部) → 浅绿 (顶部，与天空过渡)
- 地面以上使用淡蓝/白渐变模拟天空

## 交互

### Hover

- Canvas `mousemove` → 遍历树节点做 hit-test
- hit-test: `distance(mouse, treeCenter) < crownRadius`
- 找到 → 光标变为 pointer，显示 HTML tooltip
- tooltip 内容：tag 名、noteCount、health%、status、reads/updates 30d

### Click

- 点击命中树 → `onNodeClick(nodeId)` → ForestDetailPanel 打开
- 选中态：树冠外圈金色光晕 (shadowBlur + stroke)

### 拖拽

- `mousedown` 命中树 → 开始拖拽
- `mousemove` → 更新该树 fx/fy → d3-force 重新布局
- `mouseup` → 释放 fx/fy
- 拖拽中的树加阴影

### Filter

保留现有 `forestFilter` 下拉框：
- All / Healthy / Normal / Stale / Dormant
- 筛选后 force simulation 用过滤后的节点集重新计算

## 数据流（不变）

```
store.loadForestGraph() → getForestGraph(vaultId) → Rust get_forest_graph_cmd
  ↓
forestGraph: ForestGraph { nodes: ForestNode[], edges: ForestEdge[] }
  ↓
ForestCanvas 接收 graph prop → d3-force 计算布局 → Canvas 绘制
```

## 技术细节

### 性能

- 100 棵树以下：~16ms 一帧 (60fps)
- 分形深度上限 8，确保大 tag 也不会过长
- requestAnimationFrame 驱动重绘
- d3-force tick 只更新位置数据，不操作 DOM

### 状态管理

- Canvas 实例通过 `useRef` 持有
- 每次 graph 变化：清除旧 simulation → 创建新 simulation → 重绘
- Resize：debounced 更新 simulation center 并重绘

### 依赖变更

- D3.js 保留（仅用 `forceSimulation`, `forceLink`, `forceManyBody`, `forceCollide`, `forceCenter`, `forceX`, `forceY`）
- 不再使用 D3 的 SVG 渲染部分（`select`, `append`, `attr` 等）

## 文件变更

| 文件 | 动作 | 说明 |
|------|------|------|
| `src/components/forest/ForestCanvas.tsx` | **重写** | Canvas 渲染引擎：分形树 + 藤蔓 + 草坪 + 交互 |
| `src/components/forest/ForestView.tsx` | 小改 | 保持现有逻辑、调整 Canvas 对接 |
| `src/components/forest/ForestDetailPanel.tsx` | 不变 | 同上 |
| `src/index.css` | 微调 | 新增 canvas 相关样式 |

## 验收标准

- [ ] 打开 vault 后 Forest View 展示有机树形森林
- [ ] noteCount 大的 tag 树枝繁叶茂
- [ ] noteCount 小的 tag 显示为小树苗
- [ ] health 高的树翠绿，stale/dormant 枯黄/灰色
- [ ] 共现 tag 之间有贝塞尔藤蔓连接
- [ ] 底部绿色草坪可见
- [ ] hover 显示 tooltip
- [ ] click 树 → 右侧 detail panel 展示
- [ ] 拖拽树可移动位置
- [ ] filter 按 status 筛选正常
- [ ] Resume 重新加载正常
- [ ] npm test 70 tests 通过
- [ ] tsc / eslint / cargo check 通过
