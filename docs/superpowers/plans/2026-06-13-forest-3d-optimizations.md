# Forest View 3D Optimizations — Implementation Plan

> **基于：** `docs/specs/forest-view-optimizations.md` + 2026-06-13 视觉讨论确认  
> **目标：** 在现有 Three.js 3D 悬浮岛森林基础上进行美术和交互优化  
> **核心文件：** `src/components/forest/ForestCanvas.tsx`  
> **已确认决策：** 全部 spec 项纳入，优先 P0 → P1 → P2

---

## 决策汇总

| 类别 | 确认方案 |
|------|---------|
| 树冠形态 | **A. 几何体混合** — hashSeed 随机选 cone/sphere/hemisphere 组合 |
| 树排布 | **1+2+4** — d3-force 预布局 + 大树靠中心 + 共现聚类 |
| 藤蔓 | **A+D+C** — TubeGeometry + 颜色渐变 + 多股按 weight |
| 岛屿 | **全部 6 项** — 椭圆截面 + 分层泥土 + 碎石 + 悬垂 + 草丛 + 蘑菇 |
| 背景氛围 | **全部 8 项** — 天空渐变 + 星空 + 云朵 + 远景岛 + 暖光 + 柔影 + 雾 + 粒子 |
| 缩放交互 | **按 spec 规格** — 滚轮 viewSize 6–20 + 缓动 + 缩放到选中 + 双指 |

---

## 文件变更范围

| 文件 | 动作 | 说明 |
|------|------|------|
| `src/components/forest/ForestCanvas.tsx` | **重写** | 核心变更：所有美术和交互优化 |
| `src/components/forest/treeRenderer.ts` | 删除或保留 | Canvas 2D 函数（来自旧计划），本次不用 |
| `src/components/forest/__tests__/treeRenderer.test.ts` | 删除或保留 | 对应 Canvas 2D 测试，本次不用 |

所有变更集中在 `ForestCanvas.tsx` 一个文件。

---

## Task 1: 缩放交互（P0）

**范围：** 当前无任何缩放能力，需添加滚轮缩放 + 缓动 + 缩放到选中树

### Step 1.1: 滚轮缩放

```typescript
// 新增常量
const MIN_VIEW_SIZE = 6;
const MAX_VIEW_SIZE = 20;
const ZOOM_SPEED = 0.001;

// 新增 ref
const viewSizeRef = useRef(12); // 当前正交相机 viewSize
const targetViewSizeRef = useRef(12); // 缓动目标值

// 在 useEffect 中添加 wheel 事件
const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 1.1 : 0.9;
  // 双指缩放（触控板）：ctrlKey 时用不同速度
  const factor = e.ctrlKey ? 1 + (e.deltaY * 0.01) : delta;
  targetViewSizeRef.current = Math.max(
    MIN_VIEW_SIZE,
    Math.min(MAX_VIEW_SIZE, targetViewSizeRef.current * factor)
  );
};
canvasContainer.addEventListener("wheel", handleWheel, { passive: false });
```

### Step 1.2: 平滑缓动

在 `animate` 循环中添加：

```typescript
function animate() {
  animRef.current = requestAnimationFrame(animate);
  
  // 缩放缓动
  const vs = viewSizeRef.current;
  const target = targetViewSizeRef.current;
  if (Math.abs(vs - target) > 0.01) {
    const newVs = vs + (target - vs) * 0.1;
    viewSizeRef.current = newVs;
    updateCameraProjection(newVs);
  }
  
  renderer.render(scene, camera);
}
```

### Step 1.3: 缩放到选中树

点击树时（在 `handleMouseUp` 的 click 分支）：

```typescript
if (dist < 3 && hit) {
  // Zoom to tree
  const treePos = hit.mesh.position;
  const currentVs = viewSizeRef.current;
  targetViewSizeRef.current = Math.max(6, currentVs * 0.5); // zoom in
  onNodeClick(hit.node.id);
}
```

---

## Task 2: 树冠形态多样性 + 健康度视觉（P0）

**范围：** 重写 `createTreeMesh`，使每棵树形态不同

### Step 2.1: 几何体混合

```typescript
// 新增：确定性随机（复用 treeRenderer.ts 中的 hashSeed 模式）
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) / 2147483647;
}

function createTreeMesh(node: ForestNode): THREE.Group {
  const group = new THREE.Group();
  group.userData = { nodeId: node.id, isTree: true };
  const seed = hashSeed(node.id);
  const scale = 0.6 + Math.log1p(node.noteCount) * 0.5;
  
  // 树干（所有形态通用）
  const trunkH = 0.8 * scale;
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, trunkH, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ 
    color: node.status === "dormant" ? 0x9e9e9e : 0x6d4c41, 
    roughness: 0.8 
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);
  
  // 根据 seed 选择树冠形态
  const crownType = Math.floor(seed * 4); // 0-3
  const colorHex = healthColorHex(node.health, node.status);
  
  switch (crownType) {
    case 0: buildConeCrown(group, trunkH, scale, colorHex, node); break;
    case 1: buildSphereCrown(group, trunkH, scale, colorHex, node); break;
    case 2: buildHemiCrown(group, trunkH, scale, colorHex, node); break;
    case 3: buildMixedCrown(group, trunkH, scale, colorHex, node); break;
  }
  
  return group;
}
```

### Step 2.2: 健康度颜色 + 视觉层次

```typescript
function healthColorHex(health: number, status: string): number {
  if (status === "dormant") return 0x9e9e9e;
  // healthy(1.0) → 翠绿, stale(0.5) → 黄绿, 低 health → 枯黄
  const r = Math.round(0.1 + (1 - health) * 0.8) / 1; // 0.1→0.9
  const g = Math.round(0.5 + health * 0.5) / 1;       // 0.5→1.0
  const b = Math.round(0.1 + health * 0.1) / 1;       // 0.1→0.2
  // 映射到 hex
  const rh = Math.round(r * 255);
  const gh = Math.round(g * 255);
  const bh = Math.round(b * 255);
  return (rh << 16) | (gh << 8) | bh;
}

// 树冠层数
function crownLayers(noteCount: number, health: number, status: string): number {
  if (status === "dormant") return 0;
  const base = Math.min(3, Math.ceil(Math.log1p(noteCount)));
  // 健康度低时减少层数
  if (health < 0.3) return Math.max(0, base - 2);
  if (health < 0.6) return Math.max(1, base - 1);
  return base;
}
```

### Step 2.3: 四种树冠形态

```typescript
function buildConeCrown(group, trunkH, scale, color, node) {
  // 松树型：多层锥形
  const layers = crownLayers(node.noteCount, node.health, node.status);
  for (let l = 0; l < layers; l++) {
    const coneH = 0.5 * scale * (1 - l * 0.15);
    const coneR = 0.35 * scale * (1 - l * 0.2);
    const coneGeo = new THREE.ConeGeometry(coneR, coneH, 8);
    const coneMat = crownMaterial(color, node.health, node.status);
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = trunkH + l * coneH * 0.55;
    cone.castShadow = true;
    group.add(cone);
  }
}

function buildSphereCrown(group, trunkH, scale, color, node) {
  // 阔叶树型：大球体 + 顶部小球
  const mainR = 0.3 * scale;
  const mainGeo = new THREE.SphereGeometry(mainR, 8, 6);
  const mainMat = crownMaterial(color, node.health, node.status);
  const main = new THREE.Mesh(mainGeo, mainMat);
  main.position.y = trunkH + mainR * 0.7;
  main.castShadow = true;
  group.add(main);
  
  // 顶部小凸起
  const topR = mainR * 0.5;
  const topGeo = new THREE.SphereGeometry(topR, 6, 4);
  const top = new THREE.Mesh(topGeo, mainMat);
  top.position.y = trunkH + mainR * 1.5;
  top.castShadow = true;
  group.add(top);
}

function buildHemiCrown(group, trunkH, scale, color, node) {
  // 灌木型：扁平半球
  const r = 0.4 * scale;
  const geo = new THREE.SphereGeometry(r, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = crownMaterial(color, node.health, node.status);
  const crown = new THREE.Mesh(geo, mat);
  crown.position.y = trunkH;
  crown.castShadow = true;
  group.add(crown);
}

function buildMixedCrown(group, trunkH, scale, color, node) {
  // 混合型：锥 + 球组合
  buildConeCrown(group, trunkH, scale * 0.7, color, node);
  buildSphereCrown(group, trunkH + 0.1, scale * 0.6, color, node);
}
```

### Step 2.4: 树冠材质

```typescript
function crownMaterial(hexColor: number, health: number, status: string): THREE.MeshStandardMaterial {
  const opacity = status === "dormant" ? 0.3 : 0.6 + health * 0.4;
  return new THREE.MeshStandardMaterial({
    color: hexColor,
    roughness: 0.5,
    opacity,
    transparent: opacity < 1,
  });
}
```

---

## Task 3: 树木排布算法优化（P1）

**范围：** 重写 `assignGridPositions` → d3-force 预布局

### Step 3.1: d3-force 预布局

```typescript
import * as d3 from "d3";

interface LayoutNode extends d3.SimulationNodeDatum {
  id: string;
  noteCount: number;
  radius: number;
}

function computeLayout(
  nodes: ForestNode[],
  edges: { source: string; target: string; weight: number }[],
  islandRadius: number,
): Map<string, THREE.Vector3> {
  const layoutNodes: LayoutNode[] = nodes.map((n, i) => ({
    id: n.id,
    noteCount: n.noteCount,
    radius: crownRadius3D(n.noteCount), // 树冠碰撞半径
    // 大树初始靠近中心
    x: (Math.random() - 0.5) * islandRadius * (1 - rankNormalized(i, nodes.length)),
    y: (Math.random() - 0.5) * islandRadius * (1 - rankNormalized(i, nodes.length)),
  }));
  
  const layoutEdges = edges.map(e => ({
    source: e.source,
    target: e.target,
    weight: e.weight,
  }));
  
  const sim = d3.forceSimulation(layoutNodes)
    .force("collide", d3.forceCollide<LayoutNode>().radius(d => d.radius + 0.5))
    .force("radial", d3.forceRadial(
      d => islandRadius * (1 - rankNormalized(nodes.findIndex(n => n.id === d.id), nodes.length)),
      islandRadius * 0.1,
      islandRadius * 0.9,
    ).strength(0.3))
    .force("link", d3.forceLink<LayoutNode, any>(layoutEdges)
      .id(d => d.id)
      .distance(d => Math.max(1.5, 4 - d.weight * 0.3))
      .strength(d => Math.min(0.3, d.weight * 0.05))
    )
    .stop();
  
  // 跑 200 tick 收敛
  for (let i = 0; i < 200; i++) sim.tick();
  
  const positions = new Map<string, THREE.Vector3>();
  for (const n of layoutNodes) {
    positions.set(n.id, new THREE.Vector3(n.x ?? 0, ISLAND_HEIGHT * 0.35, n.y ?? 0));
  }
  return positions;
}

function rankNormalized(index: number, total: number): number {
  // 0 = most important (center), 1 = least (edge)
  return total <= 1 ? 0 : index / (total - 1);
}

function crownRadius3D(noteCount: number): number {
  return 0.25 + Math.log1p(noteCount) * 0.3;
}
```

### Step 3.2: 替换 assignGridPositions

```typescript
// 旧代码删除，替换为：
const layoutPositions = computeLayout(graph.nodes, graph.edges, ISLAND_SIZE * 0.8);
```

---

## Task 4: 藤蔓形态优化（P1）

**范围：** 重写 `createVine` → TubeGeometry + 颜色渐变 + 多股

### Step 4.1: TubeGeometry 藤蔓

```typescript
function createVine(
  a: THREE.Vector3,
  b: THREE.Vector3,
  weight: number,
  healthA: number,
  healthB: number,
  statusA: string,
  statusB: string,
): THREE.Group {
  const group = new THREE.Group();
  const strands = weight >= 5 ? 3 : weight >= 3 ? 2 : 1;
  
  for (let s = 0; s < strands; s++) {
    const offset = (s - (strands - 1) / 2) * 0.15;
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    mid.y += 0.5 + weight * 0.1;
    // 多股藤蔓偏移
    mid.x += offset;
    mid.z += offset;
    
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.04 + Math.log1p(weight) * 0.02, 6, false);
    
    // 颜色渐变：两端健康度中间色
    const mixHealth = (healthA + healthB) / 2;
    const mat = new THREE.MeshStandardMaterial({
      color: vineColorHex(mixHealth, statusA, statusB),
      roughness: 0.6,
      transparent: true,
      opacity: Math.min(0.7, 0.15 + weight / 15),
    });
    
    const tube = new THREE.Mesh(tubeGeo, mat);
    group.add(tube);
  }
  
  return group;
}

function vineColorHex(mixHealth: number, statusA: string, statusB: string): number {
  if (statusA === "dormant" && statusB === "dormant") return 0x9e9e9e;
  // 绿→黄绿→枯黄
  const g = Math.round(0.4 + mixHealth * 0.6);
  const r = Math.round(0.2 + (1 - mixHealth) * 0.6);
  return (r << 16) | (g << 8) | 0x20;
}
```

### Step 4.2: 更新调用处

```typescript
for (const edge of graph.edges) {
  const ft = treesRef.current.find((t) => t.node.id === edge.source);
  const tt = treesRef.current.find((t) => t.node.id === edge.target);
  if (ft && tt) {
    islandGroup.add(createVine(
      ft.mesh.position.clone(),
      tt.mesh.position.clone(),
      edge.weight,
      ft.node.health,
      tt.node.health,
      ft.node.status,
      tt.node.status,
    ));
  }
}
```

---

## Task 5: 悬浮岛重设计（P2）

**范围：** 重写 `createIsland` → ExtrudeGeometry 椭圆 + 分层 + 装饰

### Step 5.1: 不规则椭圆截面

```typescript
function createIslandShape(rx: number, ry: number, seed: number): THREE.Shape {
  const shape = new THREE.Shape();
  const segments = 36;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const wobble = 1 + Math.sin(angle * 3 + seed) * 0.08 + Math.sin(angle * 5 + seed * 2) * 0.04;
    const x = Math.cos(angle) * rx * wobble;
    const y = Math.sin(angle) * ry * wobble;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}
```

### Step 5.2: 分层泥土截面

```typescript
function createIsland(group: THREE.Group): void {
  const rx = ISLAND_SIZE * 0.9;
  const ry = ISLAND_SIZE * 0.7;
  const seed = 42; // 固定的岛形种子
  
  // 草地顶层
  const grassShape = createIslandShape(rx, ry, seed);
  const grassExtrudeSettings = { steps: 1, depth: ISLAND_HEIGHT * 0.35, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.05, bevelSegments: 3 };
  const grassGeo = new THREE.ExtrudeGeometry(grassShape, grassExtrudeSettings);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.6 });
  const grassMesh = new THREE.Mesh(grassGeo, grassMat);
  grassMesh.position.y = ISLAND_HEIGHT * 0.15;
  grassMesh.receiveShadow = true;
  group.add(grassMesh);
  
  // 中层泥土
  const dirtShape = createIslandShape(rx * 0.98, ry * 0.98, seed);
  const dirtGeo = new THREE.ExtrudeGeometry(dirtShape, { steps: 1, depth: ISLAND_HEIGHT * 0.5, bevelEnabled: false });
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8B6B4A, roughness: 0.9 });
  const dirtMesh = new THREE.Mesh(dirtGeo, dirtMat);
  dirtMesh.position.y = -ISLAND_HEIGHT * 0.35;
  dirtMesh.castShadow = true;
  dirtMesh.receiveShadow = true;
  group.add(dirtMesh);
  
  // 底层岩石
  const stoneShape = createIslandShape(rx * 1.02, ry * 1.02, seed);
  const stoneGeo = new THREE.ExtrudeGeometry(stoneShape, { steps: 1, depth: ISLAND_HEIGHT * 0.3, bevelEnabled: false });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6d5c4a, roughness: 0.95 });
  const stoneMesh = new THREE.Mesh(stoneGeo, stoneMat);
  stoneMesh.position.y = -ISLAND_HEIGHT * 0.85;
  group.add(stoneMesh);
}
```

### Step 5.3: 边缘碎石（InstancedMesh）

```typescript
function addEdgeGravel(group: THREE.Group, rx: number, ry: number, seed: number): void {
  const count = 40;
  const gravelGeo = new THREE.IcosahedronGeometry(0.08, 0);
  const gravelMat = new THREE.MeshStandardMaterial({ color: 0x9e8c7a, roughness: 0.8 });
  const instancedMesh = new THREE.InstancedMesh(gravelGeo, gravelMat, count);
  
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const r = (rx + ry) / 2 * (0.9 + Math.random() * 0.15);
    dummy.position.set(
      Math.cos(angle) * r,
      -ISLAND_HEIGHT * 0.3 + Math.random() * ISLAND_HEIGHT * 0.2,
      Math.sin(angle) * r * (ry / rx),
    );
    dummy.scale.setScalar(0.5 + Math.random() * 0.8);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
  }
  group.add(instancedMesh);
}
```

### Step 5.4: 岛底悬垂

```typescript
function addBottomRoots(group: THREE.Group, rx: number, ry: number): void {
  const count = 25;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = (rx + ry) / 2 * (0.3 + Math.random() * 0.7);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r * (ry / rx);
    const h = 0.2 + Math.random() * 0.6;
    
    const coneGeo = new THREE.ConeGeometry(0.04, h, 4);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x6d5c4a, roughness: 0.9 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(x, -ISLAND_HEIGHT * 0.9 - h / 2, z);
    cone.rotation.x = (Math.random() - 0.5) * 0.5;
    cone.rotation.z = (Math.random() - 0.5) * 0.5;
    group.add(cone);
  }
}
```

### Step 5.5: 草地装饰（草丛 + 蘑菇）

```typescript
function addGrassDecorations(group: THREE.Group, rx: number, ry: number, treePositions: THREE.Vector3[]): void {
  // 草丛 — InstancedMesh
  const grassCount = 60;
  const grassGeo = new THREE.ConeGeometry(0.04, 0.15, 4);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x81c784, roughness: 0.7 });
  const grassInstanced = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  
  const dummy = new THREE.Object3D();
  for (let i = 0; i < grassCount; i++) {
    // 随机位置，避免与树重叠
    let x: number, z: number;
    do {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (rx * 0.85);
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r * (ry / rx);
    } while (treePositions.some(p => 
      Math.hypot(x - p.x, z - p.z) < 0.5
    ));
    
    dummy.position.set(x, ISLAND_HEIGHT * 0.4, z);
    dummy.scale.setScalar(0.5 + Math.random() * 1.0);
    dummy.updateMatrix();
    grassInstanced.setMatrixAt(i, dummy.matrix);
  }
  group.add(grassInstanced);
  
  // 小蘑菇 — 少量手工放置
  const mushroomCount = 8;
  for (let i = 0; i < mushroomCount; i++) {
    const mushroom = createMushroom();
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * rx * 0.5;
    mushroom.position.set(
      Math.cos(angle) * r,
      ISLAND_HEIGHT * 0.4,
      Math.sin(angle) * r * (ry / rx),
    );
    group.add(mushroom);
  }
}

function createMushroom(): THREE.Group {
  const group = new THREE.Group();
  const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.7 });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.06;
  group.add(stem);
  
  const capGeo = new THREE.SphereGeometry(0.08, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const capMat = new THREE.MeshStandardMaterial({ 
    color: [0xe57373, 0xffb74d, 0xfff176][Math.floor(Math.random() * 3)], 
    roughness: 0.5 
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 0.12;
  group.add(cap);
  
  return group;
}
```

---

## Task 6: 背景天空 & 光照氛围（P2-P3）

### Step 6.1: 天空渐变

```typescript
function createSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#1a1b3e");    // 深蓝紫顶
  grad.addColorStop(0.3, "#252850");   // 深蓝
  grad.addColorStop(0.6, "#3a4a70");   // 蓝灰
  grad.addColorStop(0.8, "#4a6078");   // 柔和灰蓝
  grad.addColorStop(1, "#5a7a80");     // 暖灰绿底
  
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// 在 init 中：
scene.background = createSkyTexture();
```

### Step 6.2: 星空粒子

```typescript
function createStars(): THREE.Points {
  const count = 50;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = 8 + Math.random() * 12; // 天空层
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }
  
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ 
    color: 0xffffff, 
    size: 0.05, 
    transparent: true, 
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  return new THREE.Points(geo, mat);
}
```

### Step 6.3: 低多边形云朵

```typescript
function createCloud(x: number, y: number, z: number, scale: number): THREE.Group {
  const group = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, 
    roughness: 0.9, 
    transparent: true, 
    opacity: 0.5,
    depthWrite: false,
  });
  
  const parts = 5;
  for (let i = 0; i < parts; i++) {
    const r = 0.3 + Math.random() * 0.4;
    const geo = new THREE.SphereGeometry(r, 6, 4);
    const mesh = new THREE.Mesh(geo, cloudMat);
    mesh.position.set(
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.8,
    );
    group.add(mesh);
  }
  
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  return group;
}
```

### Step 6.4: 远景悬浮岛

```typescript
function createFarIsland(x: number, y: number, z: number, scale: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ 
    color: 0x3a4a70, 
    roughness: 0.9, 
    transparent: true, 
    opacity: 0.4,
    depthWrite: false,
  });
  
  // 简单的椭圆 + 锥形体
  const topGeo = new THREE.CylinderGeometry(0.6, 0.4, 0.3, 12);
  const top = new THREE.Mesh(topGeo, mat);
  top.position.y = 0.15;
  group.add(top);
  
  const bottomGeo = new THREE.ConeGeometry(0.6, 0.8, 12);
  const bottom = new THREE.Mesh(bottomGeo, mat);
  bottom.position.y = -0.4;
  group.add(bottom);
  
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  return group;
}
```

### Step 6.5: 暖色调灯光 + 柔和阴影 + 雾

```typescript
// 替换 init 中的灯光设置：

// Ambient — 暖绿色调
scene.add(new THREE.AmbientLight(0x889966, 0.9));

// Hemisphere — 暖黄天空 + 绿地面
scene.add(new THREE.HemisphereLight(0xffeedd, 0x556644, 0.5));

// Directional — 暖金色
const dirLight = new THREE.DirectionalLight(0xfff0d0, 1.2);
dirLight.position.set(10, 15, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048); // 从 1024 升级
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -15;
dirLight.shadow.camera.right = 15;
dirLight.shadow.camera.top = 15;
dirLight.shadow.camera.bottom = -15;
dirLight.shadow.bias = -0.0001; // 减少阴影偏移
dirLight.shadow.normalBias = 0.02;
scene.add(dirLight);

// 雾 — 匹配天空底部颜色
scene.fog = new THREE.Fog(0x5a7a80, 12, 35);
```

### Step 6.6: 萤火虫粒子

```typescript
function createFireflies(): { points: THREE.Points; update: (delta: number) => void } {
  const count = 30;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const basePositions: [number, number, number][] = [];
  
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * ISLAND_SIZE * 1.5;
    const y = ISLAND_HEIGHT + Math.random() * 2;
    const z = (Math.random() - 0.5) * ISLAND_SIZE * 1.5;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    basePositions.push([x, y, z]);
  }
  
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfff8a0,
    size: 0.06,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  const points = new THREE.Points(geo, mat);
  
  return {
    points,
    update: (delta: number) => {
      const pos = points.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const [bx, by, bz] = basePositions[i];
        pos[i * 3 + 1] = by + Math.sin(Date.now() * 0.001 + i) * 0.5;
        pos[i * 3] = bx + Math.cos(Date.now() * 0.0007 + i * 1.3) * 0.3;
        pos[i * 3 + 2] = bz + Math.sin(Date.now() * 0.0009 + i * 0.7) * 0.3;
      }
      points.geometry.attributes.position.needsUpdate = true;
    },
  };
}
```

---

## Task 7: 安装验证

### Step 7.1: TypeScript 检查

```bash
npx tsc -b
```

### Step 7.2: ESLint

```bash
npx eslint src/components/forest/ForestCanvas.tsx
```

### Step 7.3: 单元测试

```bash
npx vitest run
```

### Step 7.4: Vite build

```bash
npx vite build --logLevel warn
```

### Step 7.5: 手动冒烟测试

```bash
npm run tauri dev
```

1. 打开 sample-vault
2. 切换到 Forest 视图
3. 验证：
   - 滚轮缩放（viewSize 6-20 范围）
   - 树冠形态多样（cone/sphere/hemi/mixed）
   - 健康度颜色差异（翠绿→黄绿→枯灰）
   - 大 tag 树在岛心、小 tag 在边缘
   - 藤蔓有粗细 + 多股
   - 岛屿为不规则椭圆
   - 背景天空渐变
   - 暖色调光照
   - 拖拽旋转仍正常工作

---

## 实施顺序

```
Task 1 (缩放交互) → Task 2 (树冠多样性) → Task 3 (排布优化)
→ Task 4 (藤蔓) → Task 5 (岛屿) → Task 6 (氛围) → Task 7 (验证)
```

每个 Task 完成后运行 `npx tsc -b` 确认无类型错误。
