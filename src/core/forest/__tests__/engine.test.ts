import { describe, expect, it } from "vitest";
import {
  buildCoOccurrence,
  buildForestGraph,
  computeHealth,
  computeTreeSize,
  getTreeStatus,
  mapTreeRadius,
} from "../engine";
import type { TagStatsInput } from "../engine";

// ─── computeTreeSize ──────────────────────────────

describe("computeTreeSize", () => {
  it("returns log1p of noteCount", () => {
    expect(computeTreeSize(0)).toBeCloseTo(0);
    expect(computeTreeSize(1)).toBeCloseTo(Math.log(2));
    expect(computeTreeSize(10)).toBeCloseTo(Math.log(11));
  });

  it("grows slowly for large counts", () => {
    const small = computeTreeSize(5);
    const large = computeTreeSize(100);
    // 100 notes should not be 20x bigger than 5 notes
    expect(large / small).toBeLessThan(3);
  });
});

// ─── mapTreeRadius ────────────────────────────────

describe("mapTreeRadius", () => {
  it("maps to [16, 72] range", () => {
    const r0 = mapTreeRadius(0);
    const r100 = mapTreeRadius(100);
    expect(r0).toBeGreaterThanOrEqual(16);
    expect(r100).toBeLessThanOrEqual(72);
  });

  it("is monotonic", () => {
    expect(mapTreeRadius(10)).toBeGreaterThan(mapTreeRadius(1));
    expect(mapTreeRadius(50)).toBeGreaterThan(mapTreeRadius(10));
  });
});

// ─── computeHealth ────────────────────────────────

describe("computeHealth", () => {
  it("returns value in [0, 1]", () => {
    const h = computeHealth({ readCount30d: 0, updateCount30d: 0, staleDays: 0 });
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(1);
  });

  it("is higher for active tags", () => {
    const active = computeHealth({ readCount30d: 10, updateCount30d: 5, staleDays: 1 });
    const inactive = computeHealth({ readCount30d: 0, updateCount30d: 0, staleDays: 100 });
    expect(active).toBeGreaterThan(inactive);
  });

  it("decays with staleness", () => {
    const fresh = computeHealth({ readCount30d: 5, updateCount30d: 5, staleDays: 0 });
    const stale = computeHealth({ readCount30d: 5, updateCount30d: 5, staleDays: 180 });
    expect(fresh).toBeGreaterThan(stale * 2);
  });

  it("read activity has more weight than update", () => {
    const readHeavy = computeHealth({ readCount30d: 10, updateCount30d: 1, staleDays: 0 });
    const updateHeavy = computeHealth({ readCount30d: 1, updateCount30d: 10, staleDays: 0 });
    expect(readHeavy).toBeGreaterThan(updateHeavy);
  });
});

// ─── getTreeStatus ────────────────────────────────

describe("getTreeStatus", () => {
  it("returns dormant for >= 180 days stale", () => {
    expect(getTreeStatus(0.9, 180)).toBe("dormant");
    expect(getTreeStatus(0.1, 365)).toBe("dormant");
  });

  it("returns stale for >= 90 days but < 180", () => {
    expect(getTreeStatus(0.5, 90)).toBe("stale");
    expect(getTreeStatus(0.9, 179)).toBe("stale");
  });

  it("returns healthy for health >= 0.65 and < 90 days", () => {
    expect(getTreeStatus(0.65, 0)).toBe("healthy");
    expect(getTreeStatus(0.9, 30)).toBe("healthy");
  });

  it("returns normal as default", () => {
    expect(getTreeStatus(0.3, 10)).toBe("normal");
    expect(getTreeStatus(0.6, 89)).toBe("normal");
  });
});

// ─── buildCoOccurrence ────────────────────────────

describe("buildCoOccurrence", () => {
  it("builds co-occurrence from tag lists", () => {
    const tagsByNote = [
      ["ai", "transformer"],
      ["ai", "rag"],
      ["ai", "transformer", "llm"],
    ];

    const result = buildCoOccurrence(tagsByNote);

    // ai-transformer: appears in note1 and note3 → 2
    expect(result.get("ai::transformer")).toBe(2);
    // ai-rag: appears in note2 → 1
    expect(result.get("ai::rag")).toBe(1);
    // ai-llm: appears in note3 → 1
    expect(result.get("ai::llm")).toBe(1);
    // transformer-llm: appears in note3 → 1
    expect(result.get("llm::transformer")).toBe(1);
  });

  it("tags are sorted alphabetically in keys", () => {
    const tagsByNote = [["b", "a"]];
    const result = buildCoOccurrence(tagsByNote);
    expect(result.has("a::b")).toBe(true);
    expect(result.has("b::a")).toBe(false);
  });

  it("handles empty input", () => {
    expect(buildCoOccurrence([]).size).toBe(0);
  });

  it("handles single-tag notes", () => {
    const result = buildCoOccurrence([["single"]]);
    expect(result.size).toBe(0);
  });

  it("matches FOREST_ENGINE spec example", () => {
    // note1: [AI, Transformer]
    // note2: [AI, RAG]
    // note3: [AI, Transformer, LLM]
    const tagsByNote = [
      ["ai", "transformer"],
      ["ai", "rag"],
      ["ai", "transformer", "llm"],
    ];

    const result = buildCoOccurrence(tagsByNote);

    // AI: 3, Transformer: 2, RAG: 1, LLM: 1
    // AI - Transformer: 2
    // AI - RAG: 1
    // AI - LLM: 1
    // Transformer - LLM: 1
    expect(result.get("ai::transformer")).toBe(2);
    expect(result.get("ai::rag")).toBe(1);
    expect(result.get("ai::llm")).toBe(1);
    expect(result.get("llm::transformer")).toBe(1);
    expect(result.get("rag::transformer")).toBeUndefined();
  });
});

// ─── buildForestGraph ─────────────────────────────

describe("buildForestGraph", () => {
  const sampleTags: TagStatsInput[] = [
    {
      id: "1",
      name: "AI",
      normalizedName: "ai",
      noteCount: 3,
      readCount30d: 10,
      updateCount30d: 5,
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: "2",
      name: "RAG",
      normalizedName: "rag",
      noteCount: 1,
      readCount30d: 1,
      updateCount30d: 0,
      lastActiveAt: new Date(Date.now() - 120 * 86400000).toISOString(), // 120 days ago
    },
    {
      id: "3",
      name: "Dormant Topic",
      normalizedName: "dormant-topic",
      noteCount: 2,
      readCount30d: 0,
      updateCount30d: 0,
      lastActiveAt: new Date(Date.now() - 200 * 86400000).toISOString(), // 200 days ago
    },
  ];

  it("builds graph with correct node count", () => {
    const cooc = buildCoOccurrence([
      ["ai", "rag"],
      ["ai", "dormant-topic"],
    ]);
    const graph = buildForestGraph(sampleTags, cooc);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
  });

  it("assigns correct statuses", () => {
    const graph = buildForestGraph(sampleTags, new Map());
    const ai = graph.nodes.find((n) => n.id === "ai")!;
    const rag = graph.nodes.find((n) => n.id === "rag")!;
    const dormant = graph.nodes.find((n) => n.id === "dormant-topic")!;

    expect(ai.status).toBe("healthy");
    // rag is stale (120 days >= 90)
    expect(["stale", "dormant"]).toContain(rag.status);
    // dormant-topic is dormant (200 days >= 180)
    expect(dormant.status).toBe("dormant");
  });

  it("generates ISO timestamp", () => {
    const graph = buildForestGraph(sampleTags, new Map());
    expect(graph.generatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("health values are in [0, 1] for all nodes", () => {
    const graph = buildForestGraph(sampleTags, new Map());
    for (const node of graph.nodes) {
      expect(node.health).toBeGreaterThanOrEqual(0);
      expect(node.health).toBeLessThanOrEqual(1);
    }
  });
});
