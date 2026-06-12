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

/** Hit-test: find tree at mouse position. Returns index or -1. */
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
