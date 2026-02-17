# Deployment Summary — v7.10.0

**Branch:** `feat/portfolio-infrastructure`
**Date:** February 2026
**Commits:** 15

---

## What changed

### Error Monitoring — Sentry

Full-stack error tracking across client, server, and edge runtimes. Route-level error boundaries for auth and public pages, a global error boundary for root layout failures, and custom 404 pages. Source maps uploaded during build and deleted afterward so stack traces are readable in Sentry without serving maps to browsers. Sentry requests tunnelled through `/monitoring` to bypass ad-blockers.

**New files:**

- `sentry.client.config.ts` — browser error tracking, session replay on errors
- `sentry.server.config.ts` — Node.js server-side error tracking
- `sentry.edge.config.ts` — edge middleware error tracking
- `instrumentation-client.ts` — client instrumentation hook
- `app/(auth)/error.tsx` — auth route error boundary
- `app/(public)/error.tsx` — public route error boundary
- `app/(public)/not-found.tsx` — public 404 page
- `app/global-error.tsx` — root-level error boundary (standalone HTML)
- `app/not-found.tsx` — application-wide 404 page

### Observability — OpenTelemetry & Speed Insights

Distributed tracing via `@vercel/otel` registered in `instrumentation.ts`. Vercel Speed Insights added alongside existing Analytics in the deferred loader to track Core Web Vitals without blocking initial render.

### Health Check — `/api/health`

Database connectivity check endpoint for uptime monitors. Returns `200 OK` with `"database": "connected"` or `503 Service Unavailable` with `"database": "disconnected"`. Excluded from rate limiting. No-cache headers prevent stale responses.

### SEO — Sitemap, Structured Data, OpenGraph Images, Twitter Cards

**Dynamic sitemap** (`app/sitemap.ts`): Generates entries for static pages, all public profiles, and all public items with last-modified dates and priority values.

**JSON-LD structured data** on three page types:

- Landing page: `WebApplication` schema
- Profile pages: `Person` schema with profile URL
- Item detail pages: `Movie` or `TVSeries` schema with genre, poster, and aggregate rating

**Dynamic OpenGraph images** using Next.js `ImageResponse` (Satori):

- `app/opengraph-image.tsx` — default branding image (edge runtime)
- `app/(public)/u/[username]/opengraph-image.tsx` — profile avatar, display name, item count
- `app/(public)/u/[username]/[itemId]/opengraph-image.tsx` — item name, description, TMDB backdrop

**Twitter cards** added to root layout and explore page metadata.

### CI/CD — GitHub Actions Pipeline

Three-job pipeline in `.github/workflows/ci.yml`:

1. **Quality Gate** — format check, lint, type check, knip (unused code)
2. **Tests** — unit and integration tests (depends on quality gate)
3. **Build** — production build verification (depends on quality gate)

Runs on push to `development`/`production` and all PRs targeting those branches. Concurrency groups cancel in-progress runs (except production pushes).

### Developer Tooling

- **Husky** pre-commit hooks with **lint-staged** (ESLint + Prettier on staged files)
- **Commitlint** enforcing conventional commit messages via commit-msg hook
- **Bundle Analyzer** (`@next/bundle-analyzer`) available via `pnpm run analyze`
- **Changelogen** for automated changelog generation (`pnpm run changelog`, `pnpm run release`)

### Minor Changes

- British English spelling in user-facing copy (`organise` instead of `organize`)
- `vote_count` added to TMDB client interfaces and metadata for JSON-LD aggregate ratings
- `worker-src 'self' blob:` added to Content Security Policy
- Knip config updated to recognise Sentry and instrumentation entry points

---

## New dependencies

| Package                           | Type | Purpose                       |
| --------------------------------- | ---- | ----------------------------- |
| `@sentry/nextjs`                  | prod | Error monitoring              |
| `@vercel/otel`                    | prod | OpenTelemetry instrumentation |
| `@vercel/speed-insights`          | prod | Core Web Vitals tracking      |
| `@commitlint/cli`                 | dev  | Commit message linting        |
| `@commitlint/config-conventional` | dev  | Conventional commits config   |
| `@next/bundle-analyzer`           | dev  | Bundle size inspection        |
| `husky`                           | dev  | Git hooks                     |
| `lint-staged`                     | dev  | Run linters on staged files   |
| `changelogen`                     | dev  | Changelog generation          |

---

## Environment variables

| Variable                 | Required | Purpose                                          |
| ------------------------ | -------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SENTRY_DSN` | No       | Sentry project DSN (Sentry disabled when absent) |
| `SENTRY_AUTH_TOKEN`      | No       | Source map upload during build                   |
| `SENTRY_ORG`             | No       | Sentry organisation slug                         |
| `SENTRY_PROJECT`         | No       | Sentry project slug                              |

---

## Verification

- [ ] All quality checks pass (`pnpm run check`)
- [ ] Unit tests pass (`pnpm run test`)
- [ ] Integration tests pass (`pnpm run test:integration`)
- [ ] Build succeeds (`pnpm run build`)
- [ ] Health check responds at `/api/health`
- [ ] Sitemap accessible at `/sitemap.xml`
- [ ] OG images generate for `/`, `/u/[username]`, `/u/[username]/[itemId]`
- [ ] Sentry receives test error (if DSN configured)
