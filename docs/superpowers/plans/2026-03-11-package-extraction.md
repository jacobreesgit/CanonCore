# Package Extraction — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared code from `apps/web/lib/` into 7 monorepo packages (`packages/types`, `packages/validators`, `packages/utils`, `packages/db`, `packages/store`, `packages/services`, `packages/config`) so both `apps/web` and `apps/mobile` can consume them.

**Architecture:** Each package is a pnpm workspace package with its own `package.json` and `tsconfig.json`. Types, validators, and utils are **JIT packages** (no build step — consumers import TypeScript source directly via `exports` field). The `db` package is a **compiled package** (runs `tsc` to produce declarations for Prisma types). The `services` package extracts pure business logic from server actions, leaving the "use server" glue in `apps/web`. Config is a shared ESLint/TypeScript/Prettier config package.

**Tech Stack:** TypeScript, pnpm workspaces, Prisma 7, Zod 4, Redux Toolkit

**Prerequisites:** Plan 1 (Turborepo Monorepo Restructure) must be complete.

**Reference:** Design spec Section 3 at `docs/superpowers/specs/2026-03-11-expo-mobile-app-design.md`.

---

## Extraction Order & Rationale

Packages are extracted bottom-up by dependency:

```
1. packages/config     — shared configs (no code deps)
2. packages/types      — shared types (depends on @prisma/client only)
3. packages/validators — Zod schemas (depends on zod only)
4. packages/utils      — pure utilities (no internal deps)
5. packages/db         — Prisma client (depends on types)
6. packages/store      — Redux store (depends on types, utils)
7. packages/services   — business logic (depends on all above)
```

No circular dependencies exist between any of these packages.

---

## Chunk 1: Config Package

### Task 1: Create packages/config

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.base.json`
- Create: `packages/config/tsconfig.nextjs.json`
- Create: `packages/config/tsconfig.library.json`
- Create: `packages/config/eslint.base.mjs`
- Create: `packages/config/prettier.base.json`

- [ ] **Step 1: Create packages/config/package.json**

```json
{
  "name": "@canoncore/config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./tsconfig.base": "./tsconfig.base.json",
    "./tsconfig.nextjs": "./tsconfig.nextjs.json",
    "./tsconfig.library": "./tsconfig.library.json",
    "./eslint.base": "./eslint.base.mjs",
    "./prettier.base": "./prettier.base.json"
  },
  "dependencies": {
    "@eslint/js": "^9.28.0",
    "typescript-eslint": "^8.34.0",
    "eslint-plugin-react": "^7.37.5",
    "eslint-plugin-react-hooks": "^5.2.0"
  }
}
```

- [ ] **Step 2: Create shared TypeScript base config**

`packages/config/tsconfig.base.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "target": "ES2022",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create Next.js-specific TypeScript config**

`packages/config/tsconfig.nextjs.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "noEmit": true,
    "plugins": [{ "name": "next" }]
  }
}
```

- [ ] **Step 4: Create library TypeScript config (for packages)**

`packages/config/tsconfig.library.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 5: Create shared ESLint base config**

`packages/config/eslint.base.mjs`:

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  }
);
```

- [ ] **Step 6: Create shared Prettier base config**

`packages/config/prettier.base.json`:

```json
{
  "singleQuote": false,
  "semi": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

> **Note:** The tailwindcss plugin stays in `apps/web/.prettierrc` only — it's not needed for non-web packages.

- [ ] **Step 7: Remove packages/config/.gitkeep**

```bash
rm packages/config/.gitkeep
```

- [ ] **Step 8: Commit**

```bash
git add packages/config/
git commit -m "feat: add shared config package (@canoncore/config)"
```

---

### Task 2: Update apps/web to use shared configs

**Files:**
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/web/eslint.config.mjs`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add @canoncore/config dependency to web app**

In `apps/web/package.json`, add to `devDependencies`:

```json
"@canoncore/config": "workspace:*"
```

- [ ] **Step 2: Update apps/web/tsconfig.json to extend shared config**

```json
{
  "extends": "@canoncore/config/tsconfig.nextjs",
  "compilerOptions": {
    "target": "ES6",
    "paths": {
      "@/*": ["./*"],
      "fumadocs-mdx:collections/*": ["./.source/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    ".next-e2e/types/**/*.ts",
    ".next-e2e/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules", "temp", "_payload-ref"]
}
```

- [ ] **Step 3: Update apps/web/eslint.config.mjs to extend shared config**

```javascript
import baseConfig from "@canoncore/config/eslint.base";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  ...baseConfig,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      "node_modules/**",
      "e2e/**",
      "temp/**",
      ".source/**",
      "playwright-report/**",
      "test-results/**",
      "storybook-static/**",
      "_payload-ref/**",
    ],
  },
];
```

- [ ] **Step 4: Run install and verify**

```bash
pnpm install
pnpm run lint
pnpm run type-check
```

Expected: Both pass with the same results as before.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/eslint.config.mjs pnpm-lock.yaml
git commit -m "refactor: use @canoncore/config in web app"
```

---

## Chunk 2: Types Package

### Task 3: Create packages/types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`

- [ ] **Step 1: Create packages/types/package.json**

JIT package — no build step, consumers import TypeScript source directly:

```json
{
  "name": "@canoncore/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "peerDependencies": {
    "@prisma/client": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create packages/types/tsconfig.json**

```json
{
  "extends": "@canoncore/config/tsconfig.library",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Add `"@canoncore/config": "workspace:*"` to devDependencies in `packages/types/package.json`.

- [ ] **Step 3: Copy type definitions from apps/web/lib/types.ts**

Create `packages/types/src/index.ts` by copying the type definitions from `apps/web/lib/types.ts`.

**What moves:**
- All type exports (`Item`, `ItemFile`, `SerializedItemFile`, `ItemWithArtwork`, `TreeItem`, `FlattenedItem`, `PlaylistWithItems`, `PublicItemCard`, `SearchableItem`, `NextItem`, `QueuedFile`, `TMDBMetadataSelection`, `TmdbDisplayOptions`, `ViewMode`, `SortOption`, `FilterOption`, `PaginatedResult`, `ItemResult`, etc.)
- All constant exports (`CONTENT_FILTERS`, `VIEW_MODES`, `SORT_OPTIONS_TUPLE`, `EXPLORE_SORT_OPTIONS_TUPLE`, `VALID_SORT_OPTIONS`, `VALID_FILTER_OPTIONS`, `DEFAULT_TMDB_DISPLAY`)
- Utility functions (`serializeItemFile()`, `isValidSortOption()`, `isValidFilterOption()`, `isValidViewMode()`)
- Re-export of `SyncStatus` from `@prisma/client` (currently the only re-exported enum)
- **Add new exports** for `FileType` and `SystemPlaylistType` from `@prisma/client` — these are used as type imports in the file but NOT currently re-exported. Add `export { FileType, SystemPlaylistType } from "@prisma/client"` so consumers get them from `@canoncore/types` instead of importing `@prisma/client` directly

**What stays in `apps/web/lib/types.ts`:**
- The `export type { ItemProgress } from "./progress-utils"` line stays as a web-only re-export

**Remove from the copied file:**
- Any import from `@/lib/*` — replace with standalone or extract those too
- The `@dnd-kit/core` import (`UniqueIdentifier`) — replace with `string | number` since dnd-kit is web-only
- The `react` import (`MutableRefObject`) — replace with a generic type or keep as optional peer dep

**Critical — fix inline type import:** The `ItemWithArtwork` interface has `progress: import("./progress-utils").ItemProgress | null;` on line 273 which uses an inline `import()` type. This relative path will NOT resolve in the types package. Fix by defining the `ItemProgress` type directly in the types package:

```typescript
/** Progress data for an item and its descendants */
export interface ItemProgress {
  watchedItems: number;
  itemsWithMedia: number;
  percentage: number | null;
  totalItems: number;
}
```

Then change line 273 to: `progress: ItemProgress | null;`

- [ ] **Step 4: Update imports**

In `packages/types/src/index.ts`, replace:
- `import type { UniqueIdentifier } from "@dnd-kit/core"` → `export type UniqueIdentifier = string | number;`
- `import type { MutableRefObject } from "react"` → remove if unused, or add `react` as peer dep
- Remove `import type { ItemProgress } from "@/lib/progress-utils"` — define inline or extract later

- [ ] **Step 5: Remove packages/types/.gitkeep**

```bash
rm packages/types/.gitkeep
```

- [ ] **Step 6: Verify the package compiles**

```bash
cd packages/types
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add packages/types/
git commit -m "feat: extract shared types into @canoncore/types"
```

---

### Task 4: Update apps/web to consume @canoncore/types

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/types.ts`
- Modify: All files that import from `@/lib/types`

- [ ] **Step 1: Add dependency**

In `apps/web/package.json`, add:

```json
"@canoncore/types": "workspace:*"
```

Run `pnpm install`.

- [ ] **Step 2: Replace apps/web/lib/types.ts with re-export**

Replace the contents of `apps/web/lib/types.ts` with:

```typescript
// Re-export everything from the shared types package
export * from "@canoncore/types";

// Web-only type extensions
export type { ItemProgress } from "@/lib/progress-utils";
```

This preserves all existing `@/lib/types` imports throughout the web app — nothing else needs to change.

- [ ] **Step 3: Verify build**

```bash
pnpm run build
pnpm run type-check
pnpm run test
```

Expected: All pass. No import changes needed elsewhere because `@/lib/types` re-exports everything.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/lib/types.ts pnpm-lock.yaml
git commit -m "refactor: consume @canoncore/types in web app"
```

---

## Chunk 3: Validators Package

### Task 5: Create packages/validators

**Files:**
- Create: `packages/validators/package.json`
- Create: `packages/validators/tsconfig.json`
- Create: `packages/validators/src/index.ts`
- Create: `packages/validators/src/usernames.ts`

- [ ] **Step 1: Create packages/validators/package.json**

```json
{
  "name": "@canoncore/validators",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "dependencies": {
    "zod": "^4.2.1"
  },
  "devDependencies": {
    "@canoncore/config": "workspace:*"
  }
}
```

- [ ] **Step 2: Create packages/validators/tsconfig.json**

```json
{
  "extends": "@canoncore/config/tsconfig.library",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Copy apps/web/lib/config/usernames.ts to packages/validators/src/usernames.ts**

This file contains `RESERVED_USERNAMES` and `isUsernameReserved()` which `validations.ts` imports.

- [ ] **Step 4: Copy apps/web/lib/validations.ts to packages/validators/src/index.ts**

Replace `import { RESERVED_USERNAMES, isUsernameReserved } from "@/lib/config/usernames"` with `import { RESERVED_USERNAMES, isUsernameReserved } from "./usernames"`.

- [ ] **Step 5: Remove packages/validators/.gitkeep**

```bash
rm packages/validators/.gitkeep
```

- [ ] **Step 6: Verify**

```bash
cd packages/validators
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add packages/validators/
git commit -m "feat: extract Zod schemas into @canoncore/validators"
```

---

### Task 6: Update apps/web to consume @canoncore/validators

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/validations.ts`

- [ ] **Step 1: Add dependency and replace with re-export**

Add `"@canoncore/validators": "workspace:*"` to `apps/web/package.json`.

Replace `apps/web/lib/validations.ts` with:

```typescript
export * from "@canoncore/validators";
```

- [ ] **Step 2: Update any imports of @/lib/config/usernames**

Search for imports of `@/lib/config/usernames` in the web app. If any exist outside of validations.ts, update them to import from `@canoncore/validators` or keep the re-export path.

- [ ] **Step 3: Verify**

```bash
pnpm install
pnpm run build
pnpm run type-check
pnpm run test
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/lib/validations.ts pnpm-lock.yaml
git commit -m "refactor: consume @canoncore/validators in web app"
```

---

## Chunk 4: Utils Package

### Task 7: Create packages/utils

**Files:**
- Create: `packages/utils/package.json`
- Create: `packages/utils/tsconfig.json`
- Create: `packages/utils/src/index.ts`
- Create: `packages/utils/src/colour-utils.ts`
- Create: `packages/utils/src/cursor.ts`
- Create: `packages/utils/src/format-time.ts`
- Create: `packages/utils/src/media-metadata.ts`
- Create: `packages/utils/src/errors.ts`

- [ ] **Step 1: Create packages/utils/package.json**

```json
{
  "name": "@canoncore/utils",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./colour": {
      "types": "./src/colour-utils.ts",
      "default": "./src/colour-utils.ts"
    },
    "./cursor": {
      "types": "./src/cursor.ts",
      "default": "./src/cursor.ts"
    }
  },
  "peerDependencies": {
    "@prisma/client": "^7.0.0"
  },
  "devDependencies": {
    "@canoncore/config": "workspace:*"
  }
}
```

- [ ] **Step 2: Create packages/utils/tsconfig.json**

```json
{
  "extends": "@canoncore/config/tsconfig.library",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Copy utility files**

Copy these files from `apps/web/lib/` to `packages/utils/src/`:

| Source | Destination | Notes |
|--------|-------------|-------|
| `colour-utils.ts` | `colour-utils.ts` | Pure math, zero imports |
| `cursor.ts` | `cursor.ts` | Uses Node `Buffer` — **server-only**. Mobile app will NOT import this client-side; cursor encoding/decoding only runs on the tRPC server (packages/api). No polyfill needed. |
| `format-time.ts` | `format-time.ts` | Pure math, zero imports |
| `media-metadata.ts` | `media-metadata.ts` | Pure math, zero imports |
| `errors.ts` | `errors.ts` | Imports `@prisma/client` only |

- [ ] **Step 4: Create barrel export**

`packages/utils/src/index.ts`:

```typescript
export * from "./colour-utils";
export * from "./cursor";
export * from "./format-time";
export * from "./media-metadata";
export * from "./errors";
```

- [ ] **Step 5: Remove packages/utils/.gitkeep and verify**

```bash
rm packages/utils/.gitkeep
cd packages/utils
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add packages/utils/
git commit -m "feat: extract shared utilities into @canoncore/utils"
```

---

### Task 8: Update apps/web to consume @canoncore/utils

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/colour-utils.ts`
- Modify: `apps/web/lib/cursor.ts`
- Modify: `apps/web/lib/format-time.ts`
- Modify: `apps/web/lib/media-metadata.ts`
- Modify: `apps/web/lib/errors.ts`

- [ ] **Step 1: Add dependency**

Add `"@canoncore/utils": "workspace:*"` to `apps/web/package.json`.

- [ ] **Step 2: Replace each file with a re-export**

Replace each file's contents with a one-line re-export:

`apps/web/lib/colour-utils.ts`:
```typescript
export * from "@canoncore/utils/colour";
```

`apps/web/lib/cursor.ts`:
```typescript
export * from "@canoncore/utils/cursor";
```

`apps/web/lib/format-time.ts`:
```typescript
export * from "@canoncore/utils";
```

`apps/web/lib/media-metadata.ts`:
```typescript
export * from "@canoncore/utils";
```

`apps/web/lib/errors.ts`:
```typescript
export * from "@canoncore/utils";
```

- [ ] **Step 3: Verify**

```bash
pnpm install
pnpm run build
pnpm run type-check
pnpm run test
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/lib/colour-utils.ts apps/web/lib/cursor.ts apps/web/lib/format-time.ts apps/web/lib/media-metadata.ts apps/web/lib/errors.ts pnpm-lock.yaml
git commit -m "refactor: consume @canoncore/utils in web app"
```

---

## Chunk 5: DB Package

### Task 9: Create packages/db

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Move: `apps/web/prisma/` → `packages/db/prisma/`
- Move: `apps/web/prisma.config.ts` → `packages/db/prisma.config.ts`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Create packages/db/package.json**

```json
{
  "name": "@canoncore/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./client": {
      "types": "./src/client.ts",
      "default": "./src/client.ts"
    }
  },
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate deploy",
    "db:push": "prisma db push",
    "db:seed": "prisma db seed"
  },
  "dependencies": {
    "@prisma/client": "^7.2.0",
    "@prisma/adapter-pg": "^7.2.0"
  },
  "devDependencies": {
    "@canoncore/config": "workspace:*",
    "prisma": "^7.2.0"
  }
}
```

- [ ] **Step 2: Create packages/db/tsconfig.json**

```json
{
  "extends": "@canoncore/config/tsconfig.library",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Move prisma directory**

```bash
git mv apps/web/prisma packages/db/prisma
git mv apps/web/prisma.config.ts packages/db/prisma.config.ts
```

Update `packages/db/prisma.config.ts` — the dotenv path needs adjustment:

```typescript
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";
import path from "path";

// Load .env.local from apps/web (where secrets live)
config({ path: path.resolve(__dirname, "../../apps/web/.env.local") });
// **Note:** This path is fragile. In CI, `DATABASE_URL` should be set as an environment variable. Only load `.env.local` if it exists.

const databaseUrl = env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
    // @ts-expect-error -- directUrl is valid at runtime but missing from Prisma 7 config types
    directUrl: databaseUrl.replace(/-pooler/g, ""),
  },
});
```

- [ ] **Step 4: Create packages/db/src/client.ts**

Extract the Prisma client singleton. **Important:** Use the Prisma 7 `PrismaPg` API which accepts a config object directly — NOT `pg.Pool`. The `pg` package is NOT a dependency.

> **Note (Prisma 7):** Prisma v7 uses `provider = "prisma-client"` (not `prisma-client-js`) with a mandatory custom `output` path. The import should come from the generated path (e.g., `../generated/prisma/client`), not `@prisma/client`. Update the generator config and import path accordingly.

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient };
```

> **Note:** The audit logging extension stays in `apps/web/lib/prisma.ts` for now — it imports `@/lib/env` and `@/lib/audit-logger` which are web-specific. The web app wraps this base client with the extension.

- [ ] **Step 5: Create packages/db/src/index.ts**

```typescript
export { prisma } from "./client";
export type { PrismaClient } from "./client";

// Re-export commonly used Prisma types
export { Prisma } from "@prisma/client";
export type {
  Item,
  ItemFile,
  User,
  Playlist,
  PlaylistItem,
  WatchRecord,
  Fork,
  GoogleDriveConnection,
  SyncLog,
  AuditLog,
} from "@prisma/client";

export {
  FileType,
  SyncStatus,
  SyncLogAction,
  SyncLogStatus,
  WatchSource,
  SystemPlaylistType,
} from "@prisma/client";
```

- [ ] **Step 6: Remove packages/db/.gitkeep and verify**

```bash
rm packages/db/.gitkeep
cd packages/db
npx prisma generate
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

> **Note:** `git mv` in Step 3 already staged the move. `apps/web/prisma.config.ts` no longer exists at that path.

```bash
git add packages/db/
git commit -m "feat: extract Prisma schema and client into @canoncore/db"
```

---

### Task 10: Update apps/web to consume @canoncore/db

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/prisma.ts`
- Update: CI workflows (prisma commands now run from packages/db)

- [ ] **Step 1: Add dependency**

Add `"@canoncore/db": "workspace:*"` to `apps/web/package.json`.

- [ ] **Step 2: Update apps/web/lib/prisma.ts**

Replace with:

```typescript
import { prisma as basePrisma } from "@canoncore/db/client";
import { createAuditExtension } from "@/lib/audit-logger";

// Extend base client with audit logging
export const prisma = basePrisma.$extends(createAuditExtension(basePrisma));

export type ExtendedPrismaClient = typeof prisma;
```

- [ ] **Step 3: Update apps/web/package.json postinstall**

Change postinstall to generate Prisma from the db package:

```json
"postinstall": "fumadocs-mdx && pnpm --filter @canoncore/db db:generate"
```

- [ ] **Step 4: Update CI workflows**

In `.github/workflows/ci.yml`, update Prisma commands:
- `pnpm --filter @canoncore/web exec prisma generate` → `pnpm --filter @canoncore/db db:generate`
- `pnpm --filter @canoncore/web exec prisma migrate deploy` → `pnpm --filter @canoncore/db db:migrate`

In `.github/workflows/seed.yml`, update similarly:
- `pnpm --filter @canoncore/web exec prisma generate` → `pnpm --filter @canoncore/db db:generate`
- `pnpm --filter @canoncore/web exec prisma db seed` → `pnpm --filter @canoncore/db db:seed`

- [ ] **Step 5: Verify**

```bash
pnpm install
pnpm run build
pnpm run type-check
pnpm run test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: consume @canoncore/db in web app"
```

---

## Chunk 6: Store Package

### Task 11: Create packages/store

**Files:**
- Create: `packages/store/package.json`
- Create: `packages/store/tsconfig.json`
- Create: `packages/store/src/` (all store files)

- [ ] **Step 1: Create packages/store/package.json**

```json
{
  "name": "@canoncore/store",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./hooks": {
      "types": "./src/hooks.ts",
      "default": "./src/hooks.ts"
    },
    "./selectors": {
      "types": "./src/selectors.ts",
      "default": "./src/selectors.ts"
    },
    "./playback": {
      "types": "./src/playback-slice.ts",
      "default": "./src/playback-slice.ts"
    },
    "./types": {
      "types": "./src/types.ts",
      "default": "./src/types.ts"
    },
    "./track-helpers": {
      "types": "./src/track-helpers.ts",
      "default": "./src/track-helpers.ts"
    },
    "./ui-prefs": {
      "types": "./src/ui-prefs-slice.ts",
      "default": "./src/ui-prefs-slice.ts"
    }
  },
  "dependencies": {
    "@reduxjs/toolkit": "^2.11.2"
  },
  "peerDependencies": {
    "react": "^19",
    "react-redux": "^9.0.0"
  },
  "devDependencies": {
    "@canoncore/config": "workspace:*"
  }
}
```

> **Note:** Add `"@canoncore/utils": "workspace:*"` to dependencies when `track-helpers.ts` is updated to import from `@canoncore/utils`.

- [ ] **Step 2: Create packages/store/tsconfig.json**

```json
{
  "extends": "@canoncore/config/tsconfig.library",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Copy store files**

Copy these files from `apps/web/lib/store/` to `packages/store/src/`:

| Source | Destination |
|--------|-------------|
| `types.ts` | `types.ts` |
| `playback-slice.ts` | `playback-slice.ts` |
| `ui-prefs-slice.ts` | `ui-prefs-slice.ts` |
| `selectors.ts` | `selectors.ts` |
| `hooks.ts` | `hooks.ts` |
| `persistence-middleware.ts` | **DO NOT EXTRACT** — stays in `apps/web/lib/store/` |
| `track-helpers.ts` | `track-helpers.ts` |
| `index.ts` | `index.ts` |

> **IMPORTANT:** `packages/store/src/index.ts` must NOT import `persistence-middleware`. The extracted barrel should only re-export slices, types, selectors, hooks, and track-helpers. The `makeStore()` factory (which wires persistence middleware) must remain in `apps/web/lib/store/index.ts` as the app-specific entry point. Create a `packages/store/src/index.ts` that exports the reducers and types only.

- [ ] **Step 4: Fix track-helpers.ts import**

`track-helpers.ts` imports `@/lib/tmdb-image-utils`. Move `tmdb-image-utils.ts` to `packages/utils/src/tmdb-image-utils.ts` and update the import:

In `packages/store/src/track-helpers.ts`, replace:
```typescript
import { getTmdbPosterUrl } from "@/lib/tmdb-image-utils";
```
with:
```typescript
import { getTmdbPosterUrl } from "@canoncore/utils";
```

Add `"@canoncore/utils": "workspace:*"` to `packages/store/package.json` dependencies.

Also add `tmdb-image-utils.ts` exports to `packages/utils/src/index.ts`.

Create a re-export stub at `apps/web/lib/tmdb-image-utils.ts`:
```typescript
export * from "@canoncore/utils";
```

> **Note:** This re-exports all `@canoncore/utils` exports, not just TMDB image utilities. Consider adding a `./tmdb-image` subpath export to `@canoncore/utils` for more targeted re-exports.

- [ ] **Step 5: Update all internal imports in store files**

All store files use `./types`, `./playback-slice`, `./index` etc. imports — these should already work since the relative paths are preserved.

- [ ] **Step 6: Remove packages/store/.gitkeep and verify**

```bash
rm packages/store/.gitkeep
cd packages/store
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add packages/store/ packages/utils/src/tmdb-image-utils.ts packages/utils/src/index.ts packages/utils/package.json
git commit -m "feat: extract Redux store into @canoncore/store"
```

---

### Task 12: Update apps/web to consume @canoncore/store

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/store/` (re-export barrel)

- [ ] **Step 1: Add dependency**

Add `"@canoncore/store": "workspace:*"` to `apps/web/package.json`.

- [ ] **Step 2: Replace apps/web/lib/store/ with re-exports**

Replace `apps/web/lib/store/index.ts` with:

```typescript
export * from "@canoncore/store";
```

> **IMPORTANT:** This re-export must ALSO include `makeStore()` and `loadPersistedState()` which stay in this file (web-specific, uses persistence-middleware). Do not replace the entire file — only add the re-export alongside the existing web-specific exports.

Replace each other file similarly:

`apps/web/lib/store/hooks.ts`:
```typescript
export * from "@canoncore/store/hooks";
```

`apps/web/lib/store/selectors.ts`:
```typescript
export * from "@canoncore/store/selectors";
```

`apps/web/lib/store/types.ts`:
```typescript
export * from "@canoncore/store/types";
```

`apps/web/lib/store/playback-slice.ts`:
```typescript
export * from "@canoncore/store/playback";
```

`apps/web/lib/store/track-helpers.ts`:
```typescript
export * from "@canoncore/store/track-helpers";
```

`apps/web/lib/store/ui-prefs-slice.ts`:
```typescript
export { default } from "@canoncore/store/ui-prefs";
export * from "@canoncore/store/ui-prefs";
```

`apps/web/lib/store/persistence-middleware.ts`:
**DO NOT replace** — this file uses `localStorage` directly and is web-specific. It stays in `apps/web/lib/store/` unchanged. The mobile app will provide its own persistence (e.g., `redux-persist` + MMKV) in a later plan.

> **Note:** The exact re-export patterns depend on how each file is imported in the web app. The key principle: every existing `@/lib/store/*` import must continue to resolve. Check each consumer and adjust re-exports as needed.

- [ ] **Step 3: Verify**

```bash
pnpm install
pnpm run build
pnpm run type-check
pnpm run test
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: consume @canoncore/store in web app"
```

---

## Chunk 7: Services Package

### Task 13: Create packages/services

This is the largest extraction. Business logic from server actions moves here, leaving "use server" glue in `apps/web`.

**Files:**
- Create: `packages/services/package.json`
- Create: `packages/services/tsconfig.json`
- Create: `packages/services/src/` with domain-organised modules

- [ ] **Step 1: Create packages/services/package.json**

```json
{
  "name": "@canoncore/services",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./items": {
      "types": "./src/items/index.ts",
      "default": "./src/items/index.ts"
    },
    "./playlists": {
      "types": "./src/playlists/index.ts",
      "default": "./src/playlists/index.ts"
    },
    "./watch": {
      "types": "./src/watch/index.ts",
      "default": "./src/watch/index.ts"
    },
    "./tmdb": {
      "types": "./src/tmdb/index.ts",
      "default": "./src/tmdb/index.ts"
    },
    "./drive": {
      "types": "./src/drive/index.ts",
      "default": "./src/drive/index.ts"
    },
    "./auth": {
      "types": "./src/auth/index.ts",
      "default": "./src/auth/index.ts"
    },
    "./users": {
      "types": "./src/users/index.ts",
      "default": "./src/users/index.ts"
    }
  },
  "dependencies": {
    "@canoncore/db": "workspace:*",
    "@canoncore/types": "workspace:*",
    "@canoncore/validators": "workspace:*",
    "@canoncore/utils": "workspace:*",
    "sharp": "^0.34.0"
  },
  "devDependencies": {
    "@canoncore/config": "workspace:*"
  }
}
```

- [ ] **Step 2: Create packages/services/tsconfig.json**

```json
{
  "extends": "@canoncore/config/tsconfig.library",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create domain directories**

```bash
rm packages/services/.gitkeep
mkdir -p packages/services/src/items
mkdir -p packages/services/src/playlists
mkdir -p packages/services/src/watch
mkdir -p packages/services/src/tmdb
mkdir -p packages/services/src/drive
mkdir -p packages/services/src/auth
mkdir -p packages/services/src/users
```

- [ ] **Step 4: Extract item service**

Create `packages/services/src/items/index.ts` by extracting the pure Prisma CRUD and business logic from `apps/web/lib/item-actions.ts`.

**Pattern:** Each service function accepts a Prisma client and userId as parameters instead of calling `auth()` and `checkRateLimit()` directly:

```typescript
import type { PrismaClient } from "@canoncore/db";
import type { PaginatedResult, ItemWithArtwork } from "@canoncore/types";
import { PAGE_SIZE, encodeCursor, decodeCursor } from "@canoncore/utils/cursor";

export async function getItems(
  prisma: PrismaClient,
  userId: string,
  parentId: string | null,
  cursor?: string
): Promise<PaginatedResult<ItemWithArtwork>> {
  // Pure Prisma query + transformation logic extracted from item-actions.ts
  // ...
}

export async function createItem(
  prisma: PrismaClient,
  userId: string,
  name: string,
  parentId: string | null,
  options?: { isPublic?: boolean; inheritVisibility?: boolean }
) {
  // Pure Prisma create logic
  // ...
}

// ... etc for all pure business logic functions
```

> **Implementation note:** This is the most time-consuming task. For each function in `item-actions.ts`:
> 1. Identify the pure logic (after auth/rate-limit checks)
> 2. Extract to a service function with explicit parameters
> 3. Leave a thin wrapper in `apps/web/lib/item-actions.ts` that does auth + rate-limit + calls the service

- [ ] **Step 5: Extract remaining services**

Repeat Step 4 for each domain:

| Source Action File | Service Module | Key Functions |
|---|---|---|
| `playlist-actions.ts` | `playlists/index.ts` | CRUD, membership, sharing |
| `watch-actions.ts` | `watch/index.ts` | Watch records, status queries |
| `tmdb-actions.ts` | `tmdb/index.ts` | Search, metadata application |
| `google-drive-actions.ts` | `drive/index.ts` | Connection management, sync |
| `auth-actions.ts` | `auth/index.ts` | Sign-up, password reset |
| `user-actions.ts` | `users/index.ts` | Profile updates, images |
| `fork-actions.ts` | `items/fork.ts` | Fork logic (part of items domain) |
| `shelf-actions.ts` | `playlists/shelves.ts` | Shelf CRUD (part of playlists domain) |
| `public-auth.ts` | `items/public.ts` + `playlists/public.ts` | Public data queries |

Also extract supporting files:

| Source | Destination |
|--------|-------------|
| `lib/colour-extract.ts` | `packages/services/src/tmdb/colour-extract.ts` — **update import** `@/lib/colour-utils` → `@canoncore/utils/colour` |
| `lib/tmdb-client.ts` | `packages/services/src/tmdb/tmdb-client.ts` |
| `lib/google-drive-client.ts` | `packages/services/src/drive/google-drive-client.ts` |
| `lib/google-drive-batch.ts` | `packages/services/src/drive/google-drive-batch.ts` |
| `lib/item-utils.ts` | `packages/services/src/items/item-utils.ts` |
| `lib/progress-utils.ts` | `packages/services/src/items/progress-utils.ts` |
| `lib/watch-record-utils.ts` | `packages/services/src/watch/watch-record-utils.ts` |
| `lib/system-playlists.ts` | `packages/services/src/playlists/system-playlists.ts` |
| `lib/shelf-query-utils.ts` | `packages/services/src/playlists/shelf-query-utils.ts` |

- [ ] **Step 6: Create barrel export**

`packages/services/src/index.ts`:

> **Note:** The barrel export is minimal — consumers should prefer domain-specific subpath imports (e.g., `@canoncore/services/items`) to avoid name collisions across domains. The barrel is primarily for type re-exports.

```typescript
// Prefer subpath imports: @canoncore/services/items, @canoncore/services/playlists, etc.
// This barrel exists for convenience but may have name collisions across domains.
export * from "./items";
export * from "./playlists";
export * from "./watch";
export * from "./tmdb";
export * from "./drive";
export * from "./auth";
export * from "./users";
```

- [ ] **Step 7: Verify**

```bash
cd packages/services
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add packages/services/
git commit -m "feat: extract business logic into @canoncore/services"
```

---

### Task 14: Update apps/web to consume @canoncore/services

**Files:**
- Modify: `apps/web/package.json`
- Modify: All `apps/web/lib/*-actions.ts` files

- [ ] **Step 1: Add dependency**

Add `"@canoncore/services": "workspace:*"` to `apps/web/package.json`.

- [ ] **Step 2: Refactor server actions to use services**

Each server action file becomes a thin wrapper:

```typescript
"use server";

import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createItem as createItemService } from "@canoncore/services/items";
import { prisma } from "@/lib/prisma";
import type { ItemResult } from "@canoncore/types";

export async function createItem(
  name: string,
  parentId: string | null
): Promise<ItemResult<{ id: string }>> {
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("createItem"),
    auth(),
  ]);

  if (!rateLimitResult.success) return { error: "Rate limit exceeded" };
  if (!session?.user?.id) return { error: "Not authenticated" };

  return createItemService(prisma, session.user.id, name, parentId);
}
```

- [ ] **Step 3: Verify everything**

```bash
pnpm install
pnpm run build
pnpm run type-check
pnpm run test
pnpm run test:integration
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: consume @canoncore/services in web server actions"
```

---

## Chunk 8: Final Verification

### Task 15: Update turbo.json for package tasks

**Files:**
- Modify: `turbo.json`

- [ ] **Step 1: Add package-specific tasks to turbo.json**

```json
{
  "tasks": {
    "db:generate": {
      "cache": false
    }
  }
}
```

Add to existing tasks object.

- [ ] **Step 2: Commit**

```bash
git add turbo.json
git commit -m "chore: add package tasks to turbo.json"
```

---

### Task 16: Add package lint and type-check scripts

**Files:**
- Modify: Each `packages/*/package.json`

- [ ] **Step 1: Add scripts to each package**

Every package should have:

```json
{
  "scripts": {
    "lint": "eslint src/",
    "type-check": "tsc --noEmit"
  }
}
```

This enables `turbo run lint` and `turbo run type-check` to run across all packages.

- [ ] **Step 2: Verify turbo runs across all packages**

```bash
pnpm run lint
pnpm run type-check
```

Expected: Turbo runs lint and type-check for all packages AND apps/web.

- [ ] **Step 3: Commit**

```bash
git add packages/*/package.json
git commit -m "chore: add lint and type-check scripts to all packages"
```

---

### Task 17: Full verification

- [ ] **Step 1: Run the full check pipeline**

```bash
pnpm run check
```

Expected: format:check, lint, type-check, knip, and build all pass across all workspaces.

- [ ] **Step 2: Run all tests**

```bash
pnpm run test
pnpm run test:integration
```

Expected: All tests pass.

- [ ] **Step 3: Verify dev server**

```bash
pnpm run dev
```

Expected: Dev server starts and app works correctly.

- [ ] **Step 4: Push**

```bash
git push origin feature/monorepo-migration
```

---

## Deferred: Tasks 13-14 (Services Package)

> **Decision (2026-03-12):** Tasks 13-14 (services extraction) are deferred to Plan 3 (tRPC Migration).
>
> **Rationale:** Plan 3 replaces ALL server actions with tRPC router procedures.
> Extracting business logic into `packages/services/` now would mean refactoring
> ~10 server action files into service functions, then immediately restructuring
> those same functions again to fit tRPC router patterns. That's double the work
> for zero benefit. Instead, the service layer extraction will happen naturally
> as part of the tRPC migration — each tRPC procedure will call shared service
> functions in `packages/services/` from the start.
>
> Tasks 9-10 (DB package) are also deferred — moving `prisma/` to `packages/db/`
> changes every CI workflow, seed script, and the `prisma.config.ts` dotenv path.
> This is high risk for low immediate benefit since the web app is the only consumer.
> The DB package extraction is better done when the mobile app actually needs it (Plan 4+).

## Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Create packages/config | ✅ Done |
| 2 | Update web to use shared configs | ✅ Done |
| 3 | Create packages/types | ✅ Done |
| 4 | Update web to consume types | ✅ Done |
| 5 | Create packages/validators | ✅ Done |
| 6 | Update web to consume validators | ✅ Done |
| 7 | Create packages/utils | ✅ Done |
| 8 | Update web to consume utils | ✅ Done |
| 9 | Create packages/db | ⏭️ Deferred to Plan 4+ |
| 10 | Update web to consume db | ⏭️ Deferred to Plan 4+ |
| 11 | Create packages/store | Pending |
| 12 | Update web to consume store | Pending |
| 13 | Create packages/services | ⏭️ Deferred to Plan 3 |
| 14 | Update web to consume services | ⏭️ Deferred to Plan 3 |
| 15 | Update turbo.json | Pending |
| 16 | Add lint/type-check to packages | Pending |
| 17 | Full verification | Pending |

## Verification Criteria

- [ ] All extracted packages compile with `tsc --noEmit`
- [ ] `pnpm run build` succeeds (web app builds)
- [ ] `pnpm run lint` passes across all workspaces
- [ ] `pnpm run type-check` passes across all workspaces
- [ ] `pnpm run test` — all unit tests pass
- [ ] `pnpm run test:integration` — all integration tests pass
- [ ] `pnpm run dev` — dev server starts and app works
- [ ] No `@/lib/*` import in `packages/` (packages only import from `@canoncore/*`)
- [ ] All `apps/web/lib/*.ts` files that were extracted are now re-export stubs
