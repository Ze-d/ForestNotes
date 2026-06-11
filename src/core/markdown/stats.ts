/**
 * Simple text statistics for ForestNotes notes.
 */

/**
 * Count words in text. Splits on whitespace and filters empty strings.
 */
export function wordCount(text: string): number {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/**
 * Compute a content hash for change detection.
 * Uses a simple DJB2-like hash — fast, non-cryptographic, deterministic.
 *
 * Note: MVP uses this for quick change detection.
 * Later phases can switch to SHA-256 if collision resistance matters.
 */
export function contentHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
