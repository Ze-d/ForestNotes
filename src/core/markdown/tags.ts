/**
 * Tag extraction and normalization for ForestNotes.
 *
 * Rules:
 * - Inline tags: #tagName pattern in body text (not in code blocks or URLs)
 * - Normalization: trim, strip leading #, replace whitespace with -, lowercase
 */

const INLINE_TAG_RE = /(?<!\S)#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;

/**
 * Extract inline `#tag` references from body text.
 * Excludes # inside code fences and markdown links.
 */
export function extractInlineTags(body: string): string[] {
  // Strategy: strip fenced code blocks, then extract tags
  const stripped = stripCodeFences(body);

  const tags = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(INLINE_TAG_RE.source, "gu");

  while ((match = re.exec(stripped)) !== null) {
    const rawTag = match[1];
    // Filter out numeric-only "tags" like #1, #2024 (common in dates)
    if (/^\d+$/.test(rawTag)) continue;

    const normalized = normalizeTag(rawTag);
    if (normalized.length > 0) {
      tags.add(normalized);
    }
  }

  return Array.from(tags);
}

/**
 * Normalize a tag string:
 * - Remove leading `#`
 * - Trim whitespace
 * - Replace internal whitespace with `-`
 * - Lowercase
 */
export function normalizeTag(input: string): string {
  return input
    .trim()
    .replace(/^#\s*/, "") // strip leading # and whitespace after it
    .replace(/\s+/g, "-")
    .toLowerCase()
    .trim(); // final trim for edge cases
}

/**
 * Merge frontmatter tags and inline tags into a deduplicated, sorted array.
 */
export function mergeTags(
  frontmatterTags: string[],
  inlineTags: string[],
): string[] {
  const all = new Set<string>();
  for (const tag of frontmatterTags) all.add(normalizeTag(tag));
  for (const tag of inlineTags) all.add(normalizeTag(tag));
  return Array.from(all).sort();
}

/**
 * Strip fenced code blocks so tags inside code aren't extracted.
 */
function stripCodeFences(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "");
}
