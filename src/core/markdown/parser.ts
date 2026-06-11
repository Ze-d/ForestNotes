/**
 * ForestNotes Markdown Parser
 *
 * Parses Markdown content into structured metadata:
 * - YAML frontmatter (title, tags, dates)
 * - Inline #tags from body
 * - Word count and content hash
 *
 * Depends on: gray-matter for frontmatter, internal modules for tag/stats
 */
import matter from "gray-matter";
import { extractInlineTags, mergeTags } from "./tags";
import { contentHash, wordCount } from "./stats";

export interface ParsedNote {
  title: string;
  /** Combined and normalized tags (frontmatter + inline) */
  tags: string[];
  /** Raw tags from frontmatter (before normalization) */
  frontmatterTags: string[];
  /** Tags extracted from body */
  inlineTags: string[];
  createdAt: string | null;
  updatedAt: string | null;
  body: string;
  wordCount: number;
  contentHash: string;
  /** Non-fatal parse warnings */
  errors: string[];
}

/**
 * Parse a raw Markdown string into structured metadata.
 */
export function parseNote(rawContent: string): ParsedNote {
  const errors: string[] = [];

  // Parse frontmatter
  let frontmatter: Record<string, unknown> = {};
  let body: string;

  try {
    const parsed = matter(rawContent);
    frontmatter = parsed.data;
    body = parsed.content;
  } catch (err) {
    errors.push(`Frontmatter parse warning: ${String(err)}`);
    body = rawContent; // treat entire content as body
  }

  // Extract title
  const title = extractTitle(frontmatter, body);

  // Extract frontmatter tags
  const frontmatterTags = extractFrontmatterTags(frontmatter, errors);

  // Extract inline tags from body
  const inlineTags = extractInlineTags(body);

  // Merge and normalize
  const tags = mergeTags(frontmatterTags, inlineTags);

  // Dates
  const createdAt = extractDate(frontmatter, "created_at", errors);
  const updatedAt = extractDate(frontmatter, "updated_at", errors);

  // Stats (body only, not frontmatter)
  const words = wordCount(body);
  const hash = contentHash(rawContent);

  return {
    title,
    tags,
    frontmatterTags,
    inlineTags,
    createdAt,
    updatedAt,
    body,
    wordCount: words,
    contentHash: hash,
    errors,
  };
}

function extractTitle(fm: Record<string, unknown>, body: string): string {
  // 1. Use frontmatter title if present
  if (typeof fm.title === "string" && fm.title.trim().length > 0) {
    return fm.title.trim();
  }
  // 2. Use first H1 heading in body
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  // 3. Fallback
  return "Untitled";
}

function extractFrontmatterTags(
  fm: Record<string, unknown>,
  errors: string[],
): string[] {
  const raw = fm.tags;
  if (raw === undefined || raw === null) return [];

  if (Array.isArray(raw)) {
    return raw
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // Tags as comma-separated string
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  errors.push("Frontmatter 'tags' is not an array or string — ignoring");
  return [];
}

function extractDate(
  fm: Record<string, unknown>,
  key: string,
  errors: string[],
): string | null {
  const raw = fm[key];
  if (raw === undefined || raw === null) return null;

  if (typeof raw === "string") {
    return raw.trim() || null;
  }

  // Date object or other type
  if (raw instanceof Date) {
    return raw.toISOString(); // gray-matter parses YAML dates as Date objects
  }

  errors.push(`Frontmatter '${key}' is not a valid date string — ignoring`);
  return null;
}
