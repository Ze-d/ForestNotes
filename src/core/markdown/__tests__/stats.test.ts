import { describe, expect, it } from "vitest";
import { contentHash, wordCount } from "../stats";

describe("wordCount", () => {
  it("counts words in normal text", () => {
    expect(wordCount("The quick brown fox")).toBe(4);
  });

  it("handles multiple spaces", () => {
    expect(wordCount("The   quick   brown")).toBe(3);
  });

  it("handles newlines", () => {
    expect(wordCount("Line one\nLine two\nLine three")).toBe(6);
  });

  it("handles empty string", () => {
    expect(wordCount("")).toBe(0);
  });

  it("handles whitespace-only string", () => {
    expect(wordCount("   \n  \n  ")).toBe(0);
  });

  it("handles Markdown content", () => {
    const md = `# Hello World

This is a paragraph with some **bold** text.

- List item one
- List item two
`;
    expect(wordCount(md)).toBe(19);
  });

  it("handles single word", () => {
    expect(wordCount("Hello")).toBe(1);
  });
});

describe("contentHash", () => {
  it("returns a consistent hash for the same input", () => {
    const a = contentHash("Hello World");
    const b = contentHash("Hello World");
    expect(a).toBe(b);
  });

  it("returns different hashes for different input", () => {
    const a = contentHash("Hello World");
    const b = contentHash("Hello Worlds");
    expect(a).not.toBe(b);
  });

  it("returns an 8-char hex string", () => {
    const hash = contentHash("test");
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("handles empty string", () => {
    const hash = contentHash("");
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});
