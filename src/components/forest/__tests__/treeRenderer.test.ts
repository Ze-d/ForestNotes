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
