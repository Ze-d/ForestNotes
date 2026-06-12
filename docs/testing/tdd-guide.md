# TDD Guide

## Red-Green-Refactor Cycle

```
┌──────────────────────────────────┐
│ 1. RED — Write a failing test    │
│     ↓                            │
│ 2. GREEN — Minimal code to pass  │
│     ↓                            │
│ 3. REFACTOR — Clean while green  │
│     ↓                            │
│ 4. Commit                        │
└──────────────────────────────────┘
```

## Rules

1. **Never write implementation before the test.**
2. **Run the test and watch it fail** before implementing.
3. **Write minimal code** to make the test pass — don't over-engineer.
4. **Refactor only when green** — never refactor failing code.
5. **One test, one behavior** — don't test multiple things in one test case.

## Example (ForestNotes)

### Step 1: Red

```ts
// src/core/markdown/__tests__/tags.test.ts
import { describe, expect, it } from "vitest";
import { normalizeTag } from "../tags";

describe("normalizeTag", () => {
  it("strips leading #", () => {
    expect(normalizeTag("#AI")).toBe("ai");  // FAILS — not implemented yet
  });
});
```

### Step 2: Green

```ts
// src/core/markdown/tags.ts
export function normalizeTag(input: string): string {
  return input.replace(/^#/, "").toLowerCase();  // Minimal implementation
}
```

### Step 3: Refactor

```ts
export function normalizeTag(input: string): string {
  return input
    .trim()
    .replace(/^#\s*/, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .trim();
}
```

## Test Naming

```
describe("[module name]", () => {
  it("[specific behavior]", () => { ... });
});
```

Examples:
- `it("lowercases input")`
- `it("returns empty array for text without tags")`
- `it("health values are in [0, 1] for all nodes")`
- `it("handles empty string")`

## Test Data

- Use inline test data for simple cases
- Use `tests/fixtures/` for larger test datasets
- Never import from production data sources in tests
