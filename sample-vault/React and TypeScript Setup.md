---
title: React and TypeScript Setup
tags:
  - react
  - typescript
  - web-development
  - programming
created_at: 2026-04-20T13:00:00+09:00
updated_at: 2026-05-10T10:00:00+09:00
---

# React and TypeScript Setup

Setting up a modern #react project with #typescript for #web-development.

## Project Initialization

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
```

## Key Dependencies

For a typical #web-development project:

```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7",
    "zustand": "^5"
  },
  "devDependencies": {
    "typescript": "~5.7",
    "@types/react": "^19",
    "vite": "^6"
  }
}
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "noUnusedLocals": true
  }
}
```

## Best Practices

- Use `interface` for component props
- Leverage discriminated unions for loading/error/data states
- `as const` for literal types
- Barrel exports via `index.ts`

#typescript eliminates entire categories of runtime errors — it's essential for serious #programming projects of any size.
