/**
 * ForestNotes Forest Engine
 *
 * Converts tag metadata into a Knowledge Forest graph.
 * Pure functions — no DB or I/O dependencies.
 *
 * Ref: docs/FOREST_ENGINE.md
 */

export type TreeStatus = "healthy" | "normal" | "stale" | "dormant";

export interface ForestNode {
  id: string; // normalized tag name
  label: string; // display name
  noteCount: number;
  health: number; // [0, 1]
  status: TreeStatus;
  size: number; // log-scale size for rendering
  readCount30d: number;
  updateCount30d: number;
  lastActiveAt: string | null;
  staleDays: number;
}

export interface ForestEdge {
  source: string;
  target: string;
  weight: number;
}

export interface ForestGraph {
  nodes: ForestNode[];
  edges: ForestEdge[];
  generatedAt: string;
}

export interface TagStatsInput {
  id: string;
  name: string;
  normalizedName: string;
  noteCount: number;
  readCount30d: number;
  updateCount30d: number;
  lastActiveAt: string | null;
}

export interface TagPairCount {
  tagA: string; // normalized
  tagB: string;
  count: number;
}

// ─── Tree Size ────────────────────────────────────

/** Log-scale tree size, prevents large tags from crushing small ones. */
export function computeTreeSize(noteCount: number): number {
  return Math.log1p(noteCount);
}

/** Map tree size to pixel radius. */
export function mapTreeRadius(noteCount: number): number {
  const minRadius = 16;
  const maxRadius = 72;
  const size = computeTreeSize(noteCount);
  const maxSize = Math.log1p(100);
  return minRadius + (size / maxSize) * (maxRadius - minRadius);
}

// ─── Health ───────────────────────────────────────

export interface HealthParams {
  readCount30d: number;
  updateCount30d: number;
  staleDays: number;
}

/**
 * Compute tag health score.
 * - 60% weight on reads (knowledge recall)
 * - 40% weight on updates (knowledge maintenance)
 * - Exponential decay based on staleness
 * Output: [0, 1]
 */
export function computeHealth(params: HealthParams): number {
  const activityScore =
    0.6 * Math.log1p(params.readCount30d) +
    0.4 * Math.log1p(params.updateCount30d);

  const decay = Math.exp(-params.staleDays / 90);

  const raw = activityScore * decay;

  return clamp(raw / 3, 0, 1);
}

// ─── Status ───────────────────────────────────────

export function getTreeStatus(health: number, staleDays: number): TreeStatus {
  if (staleDays >= 180) return "dormant";
  if (staleDays >= 90) return "stale";
  if (health >= 0.65) return "healthy";
  return "normal";
}

// ─── Co-occurrence ────────────────────────────────

/**
 * Build tag co-occurrence edge counts from per-note tag lists.
 * Input: array of tag arrays, e.g. [["ai","transformer"], ["ai","rag"]]
 * Output: Map of "tagA::tagB" → count
 */
export function buildCoOccurrence(tagsByNote: string[][]): Map<string, number> {
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

/**
 * Convert co-occurrence map to ForestEdge array.
 */
export function coOccurrenceToEdges(
  cooccurrence: Map<string, number>,
): ForestEdge[] {
  const edges: ForestEdge[] = [];
  for (const [key, weight] of cooccurrence) {
    const [source, target] = key.split("::");
    edges.push({ source, target, weight });
  }
  return edges;
}

// ─── Graph Builder ────────────────────────────────

/**
 * Build a complete ForestGraph from tag stats and co-occurrence data.
 */
export function buildForestGraph(
  tagStats: TagStatsInput[],
  cooccurrence: Map<string, number>,
): ForestGraph {
  const now = new Date();

  const nodes: ForestNode[] = tagStats.map((tag) => {
    const staleDays = computeStaleDays(tag.lastActiveAt, now);
    const health = computeHealth({
      readCount30d: tag.readCount30d,
      updateCount30d: tag.updateCount30d,
      staleDays,
    });
    const status = getTreeStatus(health, staleDays);

    return {
      id: tag.normalizedName,
      label: tag.name,
      noteCount: tag.noteCount,
      health,
      status,
      size: computeTreeSize(tag.noteCount),
      readCount30d: tag.readCount30d,
      updateCount30d: tag.updateCount30d,
      lastActiveAt: tag.lastActiveAt,
      staleDays,
    };
  });

  const edges = coOccurrenceToEdges(cooccurrence);

  return {
    nodes,
    edges,
    generatedAt: now.toISOString(),
  };
}

// ─── Utilities ────────────────────────────────────

function computeStaleDays(lastActiveAt: string | null, now: Date): number {
  if (!lastActiveAt) return 365; // no activity → very stale
  const last = new Date(lastActiveAt);
  return Math.max(0, Math.floor((now.getTime() - last.getTime()) / 86400000));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
