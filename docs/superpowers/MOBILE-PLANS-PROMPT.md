# Mobile Plans — Continuation Prompt

> **Purpose:** If context runs out mid-session, paste this file's contents as the first message in a new conversation to resume plan writing.

---

## What We're Doing

Writing 12 implementation plans for turning CanonCore v2 (Next.js web app) into a Turborepo monorepo with an Expo/React Native mobile app. The approved design spec is at:

```
docs/superpowers/specs/2026-03-11-expo-mobile-app-design.md
```

Read that spec first — it contains all approved decisions.

Plans go in `docs/superpowers/plans/` following the existing naming convention (`2026-03-11-{slug}.md`).

## The 12 Plans (in order)

1. **Turborepo Monorepo Restructure** — Convert flat Next.js repo into `apps/web/` + `apps/mobile/` + `packages/` monorepo with Turborepo, pnpm workspaces, `node-linker=hoisted` for Metro compatibility
2. **Package Extraction** — Extract shared code into JIT packages (`packages/types`, `packages/validators`, `packages/utils`, `packages/config`) and compiled packages (`packages/db`, `packages/api`). Upfront extraction (not incremental) because web dev is paused
3. **tRPC Migration** — Replace ALL Server Actions with tRPC v11 routers (`satisfies TRPCRouterRecord` pattern). Web uses `createCallerFactory` for zero-overhead RSC calls. Mobile uses `@trpc/tanstack-react-query`. Package: `packages/api/`
4. **Expo Mobile App Foundation** — Scaffold `apps/mobile/` with Expo SDK 53+, Expo Router v5 (file-based navigation), NativeWind v5 (Tailwind CSS v4 for RN), JWT auth via `expo-secure-store`, dark mode cinematic theme
5. **Shared Components & Library** — Item card, grid layout, infinite scroll hook, cinematic hero, colour pipeline, Home tab (shelves, continue watching), Library tab (grid browse, folder drill-down, search)
6. **Item Detail, CRUD & TMDB** — Item detail screen (cinematic hero + metadata + files), item create/edit/delete, TMDB wizard (simplified mobile), context menus/action sheets, watch status tracking
7. **Playlists, Explore & Public** — Playlist CRUD + detail screen, explore page (public items/playlists tabs), public profiles, public item/playlist detail, fork flow
8. **Media Playback** — `expo-video` (video, PiP, DRM) + `react-native-track-player` (audio queue, background playback, lock screen controls). Mini-player, queue panel, expanded viewport
9. **Offline Downloads** — `expo-file-system` + `expo-sqlite` for local DB tracking. Download management UI, LRU storage management, offline playback
10. **Platform Features** — Chromecast (`react-native-google-cast`), AirPlay (native via `expo-video`), PiP, deep linking (Universal Links + App Links via Expo Router)
11. **Testing & CI/CD** — Jest + `jest-expo` (unit), React Native Testing Library (component), Maestro (E2E, YAML flows), Percy (visual regression). EAS Build/Submit/Update, GitHub Actions pipeline
12. **App Store Submission** — App Store Connect + Google Play Console submission, screenshots, metadata, review compliance

## Key Technical Decisions (Already Approved)

- **Migration approach:** Upfront extraction (web dev paused)
- **API layer:** tRPC v11 for EVERYTHING (web + mobile), no Server Actions remain
- **Web tRPC consumption:** `createCallerFactory` in RSC (zero network overhead), `@trpc/tanstack-react-query` in client components
- **tRPC v11 patterns:** `satisfies TRPCRouterRecord`, new package name `@trpc/tanstack-react-query`
- **Package types:** JIT (no build step) for types/validators/utils, compiled (tsc declarations) for db/api
- **pnpm config:** `node-linker=hoisted` in `.npmrc` for Expo/Metro compatibility
- **Auth:** JWT in `expo-secure-store`, sent as Bearer header
- **Media:** `expo-video` (video) + `react-native-track-player` (audio)
- **Testing:** Maestro for E2E (replaces Playwright for mobile)
- **CI/CD:** EAS Build/Submit/Update
- **Git strategy:** Long-running `feature/monorepo-migration` branch, stacked sub-branches per plan, new conversation per plan
- **No reorder** in MVP (no drag-and-drop for items or playlists)
- **No push notifications** in MVP
- **Yes:** Offline downloads, casting (Chromecast + AirPlay), PiP, lock screen controls, deep linking

## AI Tools to Use While Writing Plans

### Skills (invoke via Skill tool)
- `superpowers:writing-plans` — the structured plan-writing framework (USE THIS)
- `expo-app-design:building-native-ui` — Plans 4, 5, 6, 7
- `expo-app-design:expo-tailwind-setup` — Plan 4
- `expo-app-design:native-data-fetching` — Plans 3, 5, 6, 7
- `expo-app-design:expo-dev-client` — Plan 4
- `expo-deployment:expo-deployment` — Plans 11, 12
- `expo-deployment:expo-cicd-workflows` — Plan 11
- `react-native-best-practices:react-native-best-practices` — Plan 8
- `react-native-best-practices:github-actions` — Plan 11

### MCP Servers (call tools directly)
- **Context7** (`mcp__context7__resolve-library-id` + `mcp__context7__get-library-docs`) — pull latest docs for tRPC v11, Turborepo, Expo Router, NativeWind, expo-video, react-native-track-player, etc.
- **Expo MCP** — search Expo docs, verify SDK APIs

### Research (WebSearch/WebFetch)
- Verify any uncertain API patterns against current docs
- Check tRPC v11 latest syntax if needed

## Plan Format

Follow the `superpowers:writing-plans` skill format. Each plan should include:
- Overview & goals
- Prerequisites (which prior plans must be complete)
- Step-by-step implementation with file paths
- Verification criteria
- Estimated complexity

## Post-Plan Validation Concerns

Issues discovered during implementation that should be validated after all plans are complete:

### Plan 3: tRPC Consumer Migration Gap

The tRPC routers in `packages/api/` are complete (~80 procedures across 11 routers), but **web consumers have NOT been migrated** — server actions still exist alongside tRPC routers. Only `HomeShelves` was migrated as a proof-of-concept. Before considering Plan 3 fully done:

1. **Return type parity** — Validate that every tRPC procedure returns data in the same shape as its server action counterpart. Server actions return `ItemResult<T>`, tRPC procedures throw `TRPCError`. Consumer code must handle this difference.
2. **RSC pages with web-specific concerns** — Pages like Explore have rate-limit error UI, Drive connection status checks, and TMDB enrichment that don't cleanly map to pure tRPC calls. These need a hybrid approach (tRPC for data, thin server action wrappers for web-only concerns like `revalidatePath`, `after()`, `cache()`).
3. **`prisma as unknown as PrismaClient` cast** — The web app uses `$extends()` for audit logging, returning a type incompatible with base `PrismaClient`. This cast at injection points (`route.ts`, `server.ts`) works but is fragile. Consider a `DatabaseClient` type alias in `packages/api/` that accommodates extended clients.
4. **Dual code paths** — Until server actions are removed, both paths exist. Any bug fix must be applied in both places. Track removal progress.
5. **Client component migration** — Client components need `@trpc/tanstack-react-query` hooks instead of direct server action imports. This changes error handling, loading states, and cache invalidation patterns.

---

## Progress Tracker

Update this section as plans are written:

### Plans Written

All 12 plans have been written and are in `docs/superpowers/plans/`.

### Implementation Status

- [x] Plan 1: Turborepo Monorepo Restructure — PR #4, merged to `development`
- [x] Plan 2: Package Extraction — PR #5, merged to `development`
- [~] Plan 3: tRPC Migration — PR #6, merged to `development` (**partial**: routers built, only HomeShelves migrated on web side; server actions still in place — see Post-Plan Validation Concerns above)
- [x] Plan 4: Expo Mobile App Foundation — merged to `development` (merge → revert → re-applied with conflict fix)
- [x] Plan 5: Shared Components & Library — PR #8, merged to `development`
- [x] Plan 6: Item Detail, CRUD & TMDB — PR #9, merged to `development`
- [x] Plan 7: Playlists, Explore & Public — merged to `development`
- [ ] Plan 8: Media Playback — `docs/superpowers/plans/2026-03-11-media-playback.md`
- [ ] Plan 9: Offline Downloads — `docs/superpowers/plans/2026-03-11-offline-downloads.md`
- [ ] Plan 10: Platform Features — `docs/superpowers/plans/2026-03-11-platform-features.md`
- [ ] Plan 11: Testing & CI/CD — `docs/superpowers/plans/2026-03-11-testing-cicd.md`

Stop

- [ ] Plan 12: App Store Submission — `docs/superpowers/plans/2026-03-11-app-store-submission.md`
