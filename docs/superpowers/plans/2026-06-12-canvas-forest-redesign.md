# Canvas Forest Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace D3 SVG force graph with HTML5 Canvas fractal-tree forest rendering.

**Architecture:** Extract pure drawing functions into `treeRenderer.ts` (testable, no React/D3 dependency). Rewrite `ForestCanvas.tsx` as a Canvas-based component that uses d3-force for layout only and Canvas 2D API for all rendering. ForestView and ForestDetailPanel stay mostly unchanged.

**Tech Stack:** HTML5 Canvas 2D, d3-force (layout only), React useRef/useEffect, TypeScript, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/forest/treeRenderer.ts` | **Create** | Pure drawing functions: `drawTree`, `drawVine`, `drawGround`, `drawSky`, `statusColor`, `crownRadius`, `hashSeed`, `hitTest` |
| `src/components/forest/__tests__/treeRenderer.test.ts` | **Create** | Unit tests for statusColor, crownRadius, hashSeed, hitTest |
| `src/components/forest/ForestCanvas.tsx` | **Rewrite** | Canvas component: d3-force simulation + canvas rendering + mouse interaction |
| `src/components/forest/ForestView.tsx` | Modify | Adjust Canvas usage (graph always passed when available) |
| `src/index.css` | Modify | Add canvas cursor style |

---

### Task 1: Create treeRenderer.ts — Pure Drawing Functions

**Files:**
- Create: `src/components/forest/treeRenderer.ts`

- [ ] **Step 1: Create the file with all drawing functions**

```typescript
// src/components/forest/treeRenderer.ts
// Pure Canvas 2D drawing functions for the organic forest.
// No React, D3, or browser-API dependencies beyond CanvasRenderingContext2D.

/** Color by tree health status */
export function statusColor(status: string): string {
  switch (status) {
    case "healthy":
      return "#2f9e44";
    case "normal":
      return "#74b816";
    case "stale":
      return "#f59f00";
    case "dormant":
      return "#adb5bd";
    default:
      return "#868e96";
  }
}

/** Tree crown radius for collision detection */
export function crownRadius(noteCount: number): number {
  return 25 + noteCount * 7;
}

/** Deterministic pseudo-random seed from string (for consistent tree shapes) */
export function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) / 2147483647;
}

/** Seeded random in [0,1) */
function seededRandom(seed: number, offset: number): number {
  const x = Math.sin(seed * 127.1 + offset) * 43758.5453;
  return x - Math.floor(x);
}

/** Health → leaf color (green→yellow→gray) */
function leafColor(health: number, status: string): string {
  if (status === "dormant") return "rgba(139, 140, 122, 0.4)";
  const r = Math.round(47 + (1 - health) * 198);
  const g = Math.round(158 + (1 - health) * 20 - (health < 0.3 ? 80 : 0));
  const b = Math.round(68 - health * 30);
  return `rgba(${r},${g},${b},${0.5 + health * 0.5})`;
}

/** Draw fractal tree at (x, y) with given parameters */
export function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  noteCount: number,
  health: number,
  status: string,
  seed: number,
  selected: boolean,
): void {
  const depth = Math.min(8, Math.max(2, Math.ceil(Math.log1p(noteCount) * 2.5)));
  const branches = Math.min(5, Math.max(2, Math.floor(noteCount / 3) + 1));
  const trunkLen = 20 + noteCount * 4;

  ctx.save();

  // Selected glow
  if (selected) {
    ctx.shadowColor = "rgba(255, 193, 7, 0.6)";
    ctx.shadowBlur = 18;
  }

  drawBranch(ctx, x, y, trunkLen, -Math.PI / 2, depth, branches, health, status, seed, 0);
  ctx.restore();
}

function drawBranch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  angle: number,
  depth: number,
  branches: number,
  health: number,
  status: string,
  seed: number,
  offset: number,
): void {
  if (depth <= 0 || length < 2) return;

  const endX = x + Math.cos(angle) * length;
  const endY = y + Math.sin(angle) * length;

  // Branch color: gray for dormant, brownish-green for others
  const isDormant = status === "dormant";
  const branchAlpha = 0.4 + (depth / 8) * 0.6;
  ctx.strokeStyle = isDormant
    ? `rgba(130,130,120,${branchAlpha})`
    : `rgba(80,${60 + depth * 8},40,${branchAlpha})`;
  ctx.lineWidth = Math.max(0.8, (depth / 8) * 4 * (0.5 + health * 0.5));
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Leaves at tips
  if (depth <= 2 && status !== "dormant") {
    const leafCount = status === "stale" ? 3 : 6;
    const leafSize = 2 + health * 4;
    ctx.fillStyle = leafColor(health, status);
    for (let i = 0; i < leafCount; i++) {
      const lx = endX + (seededRandom(seed, offset + i * 0.1) - 0.5) * length * 0.6;
      const ly = endY + (seededRandom(seed, offset + i * 0.1 + 0.5) - 0.5) * length * 0.6;
      ctx.beginPath();
      ctx.ellipse(lx, ly, leafSize, leafSize * 0.6, seededRandom(seed, offset + i) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Recurse branches
  const subBranchCount = depth > 4 ? Math.min(3, branches) : Math.min(2, branches);
  for (let i = 0; i < subBranchCount; i++) {
    const spreadAngle = (seededRandom(seed, offset + i + 3) - 0.5) * 0.8;
    const newAngle = angle + spreadAngle;
    const shrink = 0.6 + seededRandom(seed, offset + i + 10) * 0.15;
    const newLength = length * shrink;
    drawBranch(ctx, endX, endY, newLength, newAngle, depth - 1, branches, health, status, seed, offset + i * 100 + 1);
  }
}

/** Draw a bezier vine between two tree edges */
export function drawVine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
  weight: number,
  health1: number,
  health2: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;

  const nx = dx / dist;
  const ny = dy / dist;

  // Start from crown edge
  const sx = x1 + nx * r1;
  const sy = y1 + ny * r1;
  const tx = x2 - nx * r2;
  const ty = y2 - ny * r2;

  // Control point perpendicular to line
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  const perp = 30 + dist * 0.15;
  const cx = mx + -ny * perp;
  const cy = my + nx * perp;

  const alpha = Math.min(0.6, 0.1 + weight / 20);
  const lineW = 1 + Math.log1p(weight);

  // Gradient from source health color to target health color
  const grad = ctx.createLinearGradient(sx, sy, tx, ty);
  grad.addColorStop(0, `rgba(${healthToRGB(health1)},${alpha})`);
  grad.addColorStop(1, `rgba(${healthToRGB(health2)},${alpha})`);

  ctx.strokeStyle = grad;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cx, cy, tx, ty);
  ctx.stroke();
}

function healthToRGB(health: number): string {
  const r = Math.round(47 + (1 - health) * 120);
  const g = Math.round(158 + (1 - health) * 40);
  const b = 68;
  return `${r},${g},${b}`;
}

/** Draw sky gradient */
export function drawSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  groundY: number,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, groundY);
  grad.addColorStop(0, "#e8f0fe");
  grad.addColorStop(0.5, "#d4e6f1");
  grad.addColorStop(1, "#c8e6c9");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, groundY);
}

/** Draw grass ground with rolling hills */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  groundY: number,
): void {
  const groundH = h - groundY;

  // Base fill
  const baseGrad = ctx.createLinearGradient(0, groundY, 0, h);
  baseGrad.addColorStop(0, "#4caf50");
  baseGrad.addColorStop(0.3, "#388e3c");
  baseGrad.addColorStop(1, "#2e7d32");
  ctx.fillStyle = baseGrad;

  ctx.beginPath();
  ctx.moveTo(0, h);

  // Undulating grass line
  for (let x = 0; x <= w; x += 20) {
    const y = groundY + Math.sin(x * 0.008) * 6 + Math.sin(x * 0.02) * 3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Light grass blades
  ctx.strokeStyle = "rgba(129, 199, 132, 0.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i < w; i += 12) {
    const bx = i + (Math.sin(i * 0.1) * 4);
    const by = groundY + Math.sin(i * 0.008) * 6 + Math.sin(i * 0.02) * 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 2, by - 8 - Math.sin(i * 0.3) * 4);
    ctx.stroke();
  }
}

/** Hit-test: find tree at mouse position */
export function hitTest(
  mx: number,
  my: number,
  nodes: { x?: number; y?: number; noteCount: number }[],
): number {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const cx = n.x ?? -100;
    const cy = n.y ?? -100;
    const r = crownRadius(n.noteCount);
    const dx = mx - cx;
    const dy = my - cy;
    if (dx * dx + dy * dy < r * r) return i;
  }
  return -1;
}
```

- [ ] **Step 2: Verify file is created**

```bash
wc -l src/components/forest/treeRenderer.ts
```
Expected: ~200 lines

---

### Task 2: Write Unit Tests for treeRenderer

**Files:**
- Create: `src/components/forest/__tests__/treeRenderer.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/components/forest/__tests__/treeRenderer.test.ts
import { describe, expect, it } from "vitest";
import { statusColor, crownRadius, hashSeed, hitTest } from "../treeRenderer";

describe("statusColor", () => {
  it("returns green for healthy", () => {
    expect(statusColor("healthy")).toBe("#2f9e44");
  });
  it("returns yellow for stale", () => {
    expect(statusColor("stale")).toBe("#f59f00");
  });
  it("returns gray for dormant", () => {
    expect(statusColor("dormant")).toBe("#adb5bd");
  });
  it("returns default for unknown", () => {
    expect(statusColor("unknown")).toBe("#868e96");
  });
});

describe("crownRadius", () => {
  it("grows with noteCount", () => {
    expect(crownRadius(1)).toBe(32);
    expect(crownRadius(10)).toBeGreaterThan(crownRadius(1));
    expect(crownRadius(100)).toBeGreaterThan(crownRadius(10));
  });
  it("minimum size for zero notes", () => {
    expect(crownRadius(0)).toBe(25);
  });
});

describe("hashSeed", () => {
  it("returns deterministic values for same input", () => {
    expect(hashSeed("ai")).toBe(hashSeed("ai"));
  });
  it("returns different values for different input", () => {
    expect(hashSeed("ai")).not.toBe(hashSeed("rag"));
  });
  it("returns value in [0,1)", () => {
    for (const id of ["a", "ai", "long-tag-name", "123"]) {
      const v = hashSeed(id);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("hitTest", () => {
  const nodes = [
    { x: 100, y: 100, noteCount: 5 },   // r = 25+35=60
    { x: 300, y: 300, noteCount: 1 },   // r = 25+7=32
  ];

  it("returns index for hit inside radius", () => {
    expect(hitTest(100, 100, nodes)).toBe(0);
    expect(hitTest(140, 100, nodes)).toBe(0); // within r=60
  });

  it("returns -1 for miss outside radius", () => {
    expect(hitTest(200, 100, nodes)).toBe(-1);
  });

  it("returns -1 for undefined coordinates", () => {
    const nodes2 = [{ noteCount: 5 }, { noteCount: 1 }];
    expect(hitTest(100, 100, nodes2)).toBe(-1);
  });

  it("returns last node when overlapping (top z-order)", () => {
    const overlapping = [
      { x: 100, y: 100, noteCount: 5 },
      { x: 110, y: 100, noteCount: 3 },
    ];
    expect(hitTest(110, 100, overlapping)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (treeRenderer doesn't exist yet — should pass since it was created)**

```bash
npx vitest run src/components/forest/__tests__/treeRenderer.test.ts
```
Expected: 12 tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/forest/treeRenderer.ts src/components/forest/__tests__/treeRenderer.test.ts
git commit -m "feat: add treeRenderer pure drawing functions with unit tests"
```

---

### Task 3: Rewrite ForestCanvas.tsx

**Files:**
- Rewrite: `src/components/forest/ForestCanvas.tsx`

- [ ] **Step 1: Write the new Canvas-based component**

```typescript
// src/components/forest/ForestCanvas.tsx
import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { ForestGraph, ForestNode } from "../../db/client";
import {
  drawTree,
  drawVine,
  drawGround,
  drawSky,
  crownRadius,
  hitTest,
  statusColor,
  hashSeed,
} from "./treeRenderer";

interface SimNode extends d3.SimulationNodeDatum, ForestNode {}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
}

interface Props {
  graph: ForestGraph;
  onNodeClick: (nodeId: string) => void;
  selectedNodeId: string | null;
}

const GROUND_RATIO = 0.85; // ground starts at 85% of canvas height

export function ForestCanvas({ graph, onNodeClick, selectedNodeId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<SimNode | null>(null);

  // Main render + simulation setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Stop old simulation
    if (simRef.current) {
      simRef.current.stop();
      simRef.current = null;
    }

    const ctx = canvas.getContext("2d")!;
    const container = canvas.parentElement!;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const groundY = h * GROUND_RATIO;

    const nodes: SimNode[] = graph.nodes.map((n) => ({
      ...n,
      x: w / 2 + (Math.random() - 0.5) * 100,
      y: groundY - crownRadius(n.noteCount) - Math.random() * 200,
    }));
    nodesRef.current = nodes;

    const edges: SimEdge[] = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    // Simulation
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(edges)
          .id((d) => d.id)
          .distance((d) => Math.max(60, 250 - d.weight * 15)),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-400))
      .force(
        "collision",
        d3
          .forceCollide<SimNode>()
          .radius((d) => crownRadius(d.noteCount) + 12),
      )
      .force("y", d3.forceY<SimNode>(groundY - 120).strength(0.08))
      .force("x", d3.forceX<SimNode>(w / 2).strength(0.05))
      .on("tick", () => {
        // Clamp trees to stay above ground and within canvas
        for (const n of nodes) {
          const cr = crownRadius(n.noteCount);
          n.x = Math.max(cr, Math.min(w - cr, n.x ?? w / 2));
          n.y = Math.min(groundY - cr, n.y ?? groundY - 100);
        }
        renderFrame();
      });

    const sim = simulation;
    simRef.current = sim;

    function renderFrame() {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Sky
      drawSky(ctx, w, groundY);

      // Ground
      drawGround(ctx, w, h, groundY);

      // Vines
      for (const e of edges) {
        const s = e.source as SimNode;
        const t = e.target as SimNode;
        const sx = s.x ?? 0;
        const sy = s.y ?? 0;
        const tx = t.x ?? 0;
        const ty = t.y ?? 0;
        const sr = crownRadius(s.noteCount);
        const tr = crownRadius(t.noteCount);
        drawVine(ctx, sx, sy, sr, tx, ty, tr, e.weight, s.health, t.health);
      }

      // Trees
      for (const n of nodes) {
        const nx = n.x ?? 0;
        const ny = n.y ?? 0;
        const seed = hashSeed(n.id);

        // Trunk shadow on ground
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.beginPath();
        ctx.ellipse(nx, ny + crownRadius(n.noteCount) * 0.3, crownRadius(n.noteCount) * 0.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        drawTree(
          ctx,
          nx,
          ny,
          n.noteCount,
          n.health,
          n.status,
          seed,
          n.id === selectedNodeId,
        );
      }

      // Tree labels
      ctx.fillStyle = "#333";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      for (const n of nodes) {
        const nx = n.x ?? 0;
        const ny = n.y ?? 0;
        const cr = crownRadius(n.noteCount);
        const label = n.label.length > 10 ? n.label.slice(0, 10) + "…" : n.label;
        ctx.fillText(label, nx, ny + cr + 14);
      }

      ctx.restore();
    }

    // Warm up simulation
    simulation.alpha(1).restart();
    for (let i = 0; i < 100; i++) simulation.tick();

    return () => {
      simulation.stop();
      simRef.current = null;
    };
  }, [graph, selectedNodeId]);

  // Canvas mouse events
  const getCanvasPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasPos(e);
      const idx = hitTest(x, y, nodesRef.current);

      // Dragging
      if (draggingRef.current) {
        const sim = simRef.current;
        draggingRef.current.fx = x;
        draggingRef.current.fy = y;
        if (sim) sim.alpha(0.1).restart();
        return;
      }

      // Hover
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = idx >= 0 ? "pointer" : "default";
      }

      // Tooltip
      if (!tooltipRef.current) {
        tooltipRef.current = document.createElement("div");
        tooltipRef.current.className = "forest-tooltip";
        tooltipRef.current.style.cssText =
          "position:absolute;pointer-events:none;opacity:0;background:var(--color-bg,#fff);border:1px solid var(--color-border,#ddd);border-radius:6px;padding:8px 12px;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:1000;";
        document.body.appendChild(tooltipRef.current);
      }

      const tip = tooltipRef.current;
      if (idx >= 0) {
        const n = nodesRef.current[idx];
        tip.style.opacity = "1";
        tip.innerHTML = `<strong>${n.label}</strong><br/>Notes: ${n.noteCount}<br/>Health: ${(n.health * 100).toFixed(0)}%<br/>Status: ${n.status}<br/>Reads (30d): ${n.readCount30d}<br/>Updates (30d): ${n.updateCount30d}`;
        tip.style.left = e.clientX + 12 + "px";
        tip.style.top = e.clientY - 10 + "px";
      } else {
        tip.style.opacity = "0";
      }
    },
    [getCanvasPos],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasPos(e);
      const idx = hitTest(x, y, nodesRef.current);
      if (idx >= 0) {
        draggingRef.current = nodesRef.current[idx];
        draggingRef.current.fx = x;
        draggingRef.current.fy = y;
        const sim = simRef.current;
        if (sim) sim.alphaTarget(0.3).restart();
      }
    },
    [getCanvasPos],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (draggingRef.current) {
        const { x, y } = getCanvasPos(e);
        const startX = draggingRef.current.fx ?? 0;
        const startY = draggingRef.current.fy ?? 0;
        const dist = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);

        if (dist < 4) {
          // This was a click, not a drag
          onNodeClick(draggingRef.current.id);
        }

        draggingRef.current.fx = null;
        draggingRef.current.fy = null;
        draggingRef.current = null;

        const sim = simRef.current;
        if (sim) sim.alphaTarget(0);
      }
    },
    [getCanvasPos, onNodeClick],
  );

  const handleMouseLeave = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = "0";
    }
    if (draggingRef.current) {
      draggingRef.current.fx = null;
      draggingRef.current.fy = null;
      draggingRef.current = null;
      const sim = simRef.current;
      if (sim) sim.alphaTarget(0);
    }
  }, []);

  // Resize handler
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Re-trigger main effect by forcing re-render
        // We use a key trick in ForestView instead — no-op here
      }, 200);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Cleanup tooltip on unmount
  useEffect(() => {
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="forest-canvas-el"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc -b
```
Expected: no errors

- [ ] **Step 3: Run ESLint**

```bash
npx eslint src/components/forest/ForestCanvas.tsx
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/forest/ForestCanvas.tsx
git commit -m "feat: rewrite ForestCanvas as Canvas-based fractal forest renderer"
```

---

### Task 4: Update ForestView and CSS

**Files:**
- Modify: `src/components/forest/ForestView.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Update ForestView to trigger Canvas resize on container change**

The current ForestView already works correctly. Only need to adjust the canvas class name. Update `src/components/forest/ForestView.tsx` line 130 — the `ForestCanvas` component import and usage work as-is because the Props interface is unchanged (`graph`, `onNodeClick`, `selectedNodeId`). No code changes needed in ForestView.

- [ ] **Step 2: Add canvas CSS**

```css
/* Add to src/index.css, after .forest-svg */

.forest-canvas-el {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
}
```

- [ ] **Step 3: Remove old .forest-svg CSS (no longer needed)**

Delete this block from `src/index.css`:
```css
.forest-svg {
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: update CSS for Canvas forest + remove old SVG styles"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc -b
```

- [ ] **Step 2: ESLint check**

```bash
npx eslint .
```

- [ ] **Step 3: Run all unit tests**

```bash
npx vitest run
```
Expected: 82 tests (70 original + 12 new treeRenderer tests)

- [ ] **Step 4: Vite build**

```bash
npx vite build --logLevel warn
```
Expected: builds successfully

- [ ] **Step 5: Cargo check**

```bash
cd src-tauri && cargo check
```
Expected: compiles (3 dead_code warnings)

- [ ] **Step 6: Manual smoke test instructions**

1. `npm run tauri dev`
2. Open `sample-vault/` folder
3. Switch to **Forest** view
4. Verify: fractal trees visible, grass ground at bottom, hover tooltips, click opens detail panel, drag moves trees, filter works

- [ ] **Step 7: Commit final verification**

```bash
git add -A
git commit -m "chore: final verification for canvas forest redesign"
```
