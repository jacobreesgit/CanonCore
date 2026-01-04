# Deployment 0.18.0 - Database Seeding

**Date**: 2026-01-04
**Branch**: development

## Summary

This release adds a database seeding system for development and QA testing. The seed script creates sample users with realistic media library data including movies, TV shows, and music. Multiple safety checks prevent accidental seeding of production databases.

## Changes

### Seed Script

New `prisma/seed.ts` creates:

- **3 Users** with shared password (from `SEED_PASSWORD` env var)
  - `seed@canoncore.com` (Alex Demo) - Full demo data
  - `seed2@canoncore.com` (Jordan Test) - Minimal data
  - `seed3@canoncore.com` (Sam Empty) - Empty account

- **Sample Data** for Alex Demo:
  - 10 Movies with varying file configurations
  - 4 TV Shows with 11 episodes across seasons
  - 2 Music albums
  - 3 Empty folders (Documentaries, Favorites, Mandalorian)
  - ~111 total files covering all test scenarios

### Safety Features

The seed script refuses to run unless:

1. `ALLOW_SEEDING=true` in environment
2. `DATABASE_URL` contains safe patterns (development, localhost, neondb, neon.tech)
3. `SEED_PASSWORD` is set

### NPM Scripts

| Script | Description |
|--------|-------------|
| `pnpm run db:seed` | Seed database with sample data |
| `pnpm run db:clear-seed` | Remove seed data only |
| `pnpm run db:reset` | Reset database and re-seed |

### Configuration

Added seed command to `prisma.config.ts`:

```typescript
migrations: {
  path: "prisma/migrations",
  seed: "npx tsx prisma/seed.ts",
},
```

### Environment Variables

New optional variables in `lib/env.ts`:

```typescript
SEED_PASSWORD: z.string().optional(),
ALLOW_SEEDING: z.string().optional(),
```

## Files Changed

```
lib/env.ts                            # Add seeding env vars
package.json                          # Add db:seed scripts, tsx dependency
prisma.config.ts                      # Add seed command
prisma/seed.ts                        # NEW: Main seed script
prisma/clear-seed.ts                  # NEW: Clear seed data script
tests/unit/prisma/seed.test.ts        # NEW: Unit tests
tests/integration/prisma/seed.test.ts # NEW: Integration tests
```

## Test Results

- **Unit tests**: 240 passed (+8)
- **Integration tests**: 53 passed (+5)

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install` (adds tsx dependency)
3. Add to `.env.local`:
   ```
   SEED_PASSWORD="your-password"
   ALLOW_SEEDING="true"
   ```
4. Run `pnpm run db:seed` to populate sample data
5. Run `pnpm run check` to verify build

## Usage

After deployment, sign in with:

- **Email**: `seed@canoncore.com`
- **Password**: (value of SEED_PASSWORD)

This account has a complete media library for testing all features.
