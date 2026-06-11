import { describe, expect, it } from "vitest";
import { extractInlineTags, mergeTags, normalizeTag } from "../tags";

describe("normalizeTag", () => {
  it("strips leading #", () => {
    expect(normalizeTag("#AI")).toBe("ai");
  });

  it("lowercases input", () => {
    expect(normalizeTag("MachineLearning")).toBe("machinelearning");
    expect(normalizeTag("#TRANSFORMER")).toBe("transformer");
  });

  it("replaces whitespace with hyphens", () => {
    expect(normalizeTag("Machine Learning")).toBe("machine-learning");
    expect(normalizeTag("deep  learning")).toBe("deep-learning");
  });

  it("trims whitespace", () => {
    expect(normalizeTag("  AI  ")).toBe("ai");
    expect(normalizeTag(" #  Tag ")).toBe("tag");
  });

  it("handles already normalized tags", () => {
    expect(normalizeTag("ai")).toBe("ai");
    expect(normalizeTag("machine-learning")).toBe("machine-learning");
  });

  it("handles empty string", () => {
    expect(normalizeTag("")).toBe("");
    expect(normalizeTag("  ")).toBe("");
  });

  it("handles mixed case kebab tags", () => {
    expect(normalizeTag("#Large-Language-Model")).toBe(
      "large-language-model",
    );
  });
});

describe("extractInlineTags", () => {
  it("extracts simple inline tags", () => {
    const body = "This is about #AI and #MachineLearning.";
    expect(extractInlineTags(body)).toEqual(["ai", "machinelearning"]);
  });

  it("returns deduplicated tags", () => {
    const body = "#AI is great. #AI is powerful.";
    expect(extractInlineTags(body)).toEqual(["ai"]);
  });

  it("ignores tags inside code fences", () => {
    const body = [
      "Here is some #important text.",
      "```python",
      "# This is a comment, not a tag",
      "print('#tag inside code')",
      "```",
      "And another #real-tag here.",
    ].join("\n");
    const tags = extractInlineTags(body);
    expect(tags).toContain("important");
    expect(tags).toContain("real-tag");
    expect(tags).not.toContain("tag");
    expect(tags).not.toContain("comment");
  });

  it("ignores numeric-only tags", () => {
    const body = "I have #42 reasons and #2024 is the year.";
    expect(extractInlineTags(body)).toEqual([]);
  });

  it("handles tags with hyphens and underscores", () => {
    const body = "Using #deep-learning and #machine_learning techniques.";
    expect(extractInlineTags(body)).toContain("deep-learning");
    expect(extractInlineTags(body)).toContain("machine_learning");
  });

  it("returns empty array for text without tags", () => {
    expect(extractInlineTags("No tags here.")).toEqual([]);
  });

  it("handles empty string", () => {
    expect(extractInlineTags("")).toEqual([]);
  });

  it("handles CJK characters in tags", () => {
    const body = "关于 #人工智能 和 #机器学习 的笔记";
    const tags = extractInlineTags(body);
    // CJK chars with spaces become hyphenated
    expect(tags.length).toBeGreaterThan(0);
  });
});

describe("mergeTags", () => {
  it("merges and deduplicates", () => {
    const fm = ["AI", "Transformer"];
    const inline = ["ai", "rag"];
    expect(mergeTags(fm, inline)).toEqual(["ai", "rag", "transformer"]);
  });

  it("sorts alphabetically", () => {
    expect(mergeTags(["C"], ["A", "B"])).toEqual(["a", "b", "c"]);
  });

  it("handles empty arrays", () => {
    expect(mergeTags([], [])).toEqual([]);
    expect(mergeTags(["AI"], [])).toEqual(["ai"]);
    expect(mergeTags([], ["ai"])).toEqual(["ai"]);
  });
});
