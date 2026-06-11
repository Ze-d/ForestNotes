import { describe, expect, it } from "vitest";
import { parseNote } from "../parser";

// Helper: create a minimal note string
function note(frontmatter: string, body = ""): string {
  return `---\n${frontmatter}\n---\n\n${body}`.trimStart();
}

describe("parseNote", () => {
  // ─── Title ──────────────────────────────────────

  it("extracts title from frontmatter", () => {
    const result = parseNote(note("title: My Note"));
    expect(result.title).toBe("My Note");
  });

  it("falls back to first H1 when no frontmatter title", () => {
    const result = parseNote(note("tags: []", "# My Heading\n\nBody text"));
    expect(result.title).toBe("My Heading");
  });

  it('returns "Untitled" when no title found', () => {
    const result = parseNote(note("tags: []", "Just some body text"));
    expect(result.title).toBe("Untitled");
  });

  // ─── Tags ───────────────────────────────────────

  it("extracts tags from frontmatter array", () => {
    const result = parseNote(
      note("title: Test\ntags:\n  - AI\n  - Transformer"),
    );
    expect(result.frontmatterTags).toEqual(["AI", "Transformer"]);
    expect(result.tags).toContain("ai");
    expect(result.tags).toContain("transformer");
  });

  it("extracts tags from comma-separated frontmatter string", () => {
    const result = parseNote(note("title: Test\ntags: AI, Transformer, RAG"));
    expect(result.frontmatterTags).toEqual(["AI", "Transformer", "RAG"]);
  });

  it("extracts inline tags from body", () => {
    const result = parseNote(
      note("title: Test\ntags: []", "This is about #AI and #RAG."),
    );
    expect(result.inlineTags).toContain("ai");
    expect(result.inlineTags).toContain("rag");
  });

  it("merges frontmatter and inline tags", () => {
    const result = parseNote(
      note("title: Test\ntags:\n  - AI", "Also covers #RAG and #Transformer"),
    );
    expect(result.tags).toContain("ai");
    expect(result.tags).toContain("rag");
    expect(result.tags).toContain("transformer");
    // Deduplicated: frontmatter AI + no duplicate
    expect(result.tags.filter((t) => t === "ai").length).toBe(1);
  });

  it("handles missing tags gracefully", () => {
    const result = parseNote(note("title: Test"));
    expect(result.frontmatterTags).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it("warns on invalid tags type", () => {
    const result = parseNote(note("title: Test\ntags: 42"));
    expect(result.frontmatterTags).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("tags");
  });

  // ─── Dates ──────────────────────────────────────

  it("extracts created_at from frontmatter", () => {
    const result = parseNote(
      note(
        "title: Test\ncreated_at: 2026-06-10T17:30:00+09:00\ntags: []",
      ),
    );
    expect(result.createdAt).toBe("2026-06-10T08:30:00.000Z");
  });

  it("extracts updated_at from frontmatter", () => {
    const result = parseNote(
      note(
        "title: Test\nupdated_at: 2026-06-09T10:00:00Z\ntags: []",
      ),
    );
    expect(result.updatedAt).toBe("2026-06-09T10:00:00.000Z");
  });

  it("returns null for missing dates", () => {
    const result = parseNote(note("title: Test\ntags: []"));
    expect(result.createdAt).toBeNull();
    expect(result.updatedAt).toBeNull();
  });

  // ─── Body ────────────────────────────────────────

  it("separates frontmatter from body", () => {
    const body = "This is the body\nwith multiple lines.";
    const result = parseNote(note("title: Test\ntags: []", body));
    expect(result.body.trim()).toBe(body);
  });

  // ─── Stats ───────────────────────────────────────

  it("computes word count from body only", () => {
    const body = "The quick brown fox jumps over the lazy dog.";
    const result = parseNote(note("title: Test\ntags: []", body));
    expect(result.wordCount).toBe(9);
  });

  it("computes content hash", () => {
    const raw = note("title: Test\ntags: []", "Body");
    const result = parseNote(raw);
    expect(result.contentHash).toMatch(/^[0-9a-f]{8}$/);
  });

  // ─── Error handling ──────────────────────────────

  it("handles completely invalid frontmatter", () => {
    const raw = "---\nthis: is: not: valid: yaml\n---\n\n# My Note\n\nBody";
    const result = parseNote(raw);
    // Should not throw — uses errors array
    expect(result.title).toBe("My Note"); // fallback to H1
  });

  it("parses raw text without frontmatter", () => {
    const result = parseNote("# Hello\n\nThis is a simple note.");
    expect(result.title).toBe("Hello");
    expect(result.body).toContain("This is a simple note.");
    expect(result.tags).toEqual([]);
    expect(result.errors.length).toBe(0);
  });

  it("handles empty string", () => {
    const result = parseNote("");
    expect(result.title).toBe("Untitled");
    expect(result.body).toBe("");
    expect(result.tags).toEqual([]);
    expect(result.wordCount).toBe(0);
  });

  // ─── Spec examples ───────────────────────────────

  it("matches DATABASE_SCHEMA spec: tag normalization", () => {
    expect(parseNote(note("tags:\n  - '#AI'", "")).tags).toContain("ai");
    expect(
      parseNote(
        note("tags:\n  - 'Machine Learning'", ""),
      ).tags,
    ).toContain("machine-learning");
    expect(
      parseNote(note("tags:\n  - '  Transformer '", "")).tags,
    ).toContain("transformer");
  });

  it("handles CJK tags", () => {
    const result = parseNote(
      note("title: 测试\ntags:\n  - 人工智能", "#机器学习 相关"),
    );
    expect(result.tags).toContain("人工智能");
    // inline tag 机器学习 becomes normalized
    expect(result.inlineTags).toContain("机器学习");
  });
});
