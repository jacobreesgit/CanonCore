# Seed Unique Content Per User Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate duplicate movies and TV shows across seed users so each user has a unique, thematically consistent collection on the Explore page.

**Architecture:** Update `USER_CONTENT_DISTRIBUTION` in `prisma/seed-config.ts` with zero-overlap content per user. Each user gets a distinct persona with movies and TV shows that match their theme. Add unit tests to verify no content overlap exists.

**Tech Stack:** TypeScript, Vitest, Prisma seed

---

## Content Changes Summary

### Content Being Removed

**Movies removed:**

- `19404` - Dilwale Dulhania Le Jayenge (Bollywood classic)

**TV Shows removed:**

- `60625` - Rick and Morty
- `1418` - The Big Bang Theory
- `456` - The Simpsons
- `1100` - How I Met Your Mother
- `71912` - The Witcher
- `84958` - Loki

### Content Being Added

**Movies added:**

- `680` - Pulp Fiction
- `13` - Forrest Gump
- `603` - The Matrix
- `194` - Amélie
- `598` - City of God
- `1417` - Pan's Labyrinth
- `27205` - Inception
- `157336` - Interstellar
- `78` - Blade Runner
- `438631` - Dune
- `329865` - Arrival
- `264660` - Ex Machina
- `286217` - The Martian

**TV Shows added:**

- `1398` - The Sopranos
- `93405` - Squid Game
- `70523` - Dark
- `2316` - The Office
- `1668` - Friends
- `63639` - The Expanse
- `42009` - Black Mirror

---

## Content Assignment (Zero Overlap)

| User             | Persona             | Movies                                                                                                                                                                                | TV Shows                                                                                       |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **demo**         | Classic Cinema Buff | The Shawshank Redemption (278), The Godfather (238), The Godfather Part II (240), Schindler's List (424), 12 Angry Men (389), Pulp Fiction (680), Forrest Gump (13), The Matrix (603) | Breaking Bad (1396), The Sopranos (1398)                                                       |
| **filmfan**      | International Film  | Spirited Away (129), Parasite (496243), Life Is Beautiful (637), Amélie (194), City of God (598), Pan's Labyrinth (1417)                                                              | Squid Game (93405), Dark (70523)                                                               |
| **bingewatcher** | Peak TV Enthusiast  | The Dark Knight (155), Inception (27205), Interstellar (157336)                                                                                                                       | Game of Thrones (1399), Stranger Things (66732), The Office (2316), Friends (1668)             |
| **scifi_jordan** | Sci-Fi/Fantasy Fan  | Blade Runner (78), Dune (438631), Arrival (329865), Ex Machina (264660), The Martian (286217)                                                                                         | Doctor Who Classic (121), Doctor Who Modern (57243), The Expanse (63639), Black Mirror (42009) |
| **test**         | Empty (for E2E)     | —                                                                                                                                                                                     | —                                                                                              |

**Notes:**

- `test@canoncore.com` **intentionally changed** from having content (`[278, 155, 129]` movies, `[1396, 60625]` shows) to empty arrays so E2E tests start with a clean slate
- Doctor Who (both Classic and Modern) stays with scifi_jordan as a themed pair
- No TMDB ID appears in more than one user's config
- User emails (e.g., `scifi@canoncore.com`) are the keys in `USER_CONTENT_DISTRIBUTION`; usernames (e.g., `scifi_jordan`) are separate fields in `SEED_USERS`

---

## Task 1: Update USER_CONTENT_DISTRIBUTION with unique content

**Files:**

- Modify: `prisma/seed-config.ts:257-278`

**Step 1: Update the USER_CONTENT_DISTRIBUTION object**

Replace lines 257-278 with the new zero-overlap distribution:

```typescript
/** Content distribution per user for visual variety (zero overlap). */
export const USER_CONTENT_DISTRIBUTION: Record<string, UserContentConfig> = {
  "demo@canoncore.com": {
    // Classic Cinema Buff - award-winning American classics
    movieIds: [278, 238, 240, 424, 389, 680, 13, 603],
    // Shawshank, Godfather I/II, Schindler's, 12 Angry Men, Pulp Fiction, Forrest Gump, Matrix
    showIds: [1396, 1398], // Breaking Bad, The Sopranos
  },
  "filmfan@canoncore.com": {
    // International Film Lover - foreign language masterpieces
    movieIds: [129, 496243, 637, 194, 598, 1417],
    // Spirited Away, Parasite, Life Is Beautiful, Amélie, City of God, Pan's Labyrinth
    showIds: [93405, 70523], // Squid Game, Dark
  },
  "bingewatcher@canoncore.com": {
    // Peak TV Enthusiast - Christopher Nolan films + binge-worthy shows
    movieIds: [155, 27205, 157336],
    // Dark Knight, Inception, Interstellar
    showIds: [1399, 66732, 2316, 1668], // Game of Thrones, Stranger Things, The Office, Friends
  },
  "scifi@canoncore.com": {
    // Sci-Fi/Fantasy Fan - science fiction films and shows
    movieIds: [78, 438631, 329865, 264660, 286217],
    // Blade Runner, Dune, Arrival, Ex Machina, The Martian
    showIds: [121, 57243, 63639, 42009], // Doctor Who (Classic + Modern), The Expanse, Black Mirror
  },
  "test@canoncore.com": {
    // Empty for E2E testing - start with clean slate
    movieIds: [],
    showIds: [],
  },
};
```

**Step 2: Update MOVIE_IDS to include all unique movies**

Replace lines 138-149 with the complete list of unique movie IDs:

```typescript
/** Movie TMDB IDs to seed (superset of all user movies). */
export const MOVIE_IDS = [
  // demo - Classic Cinema Buff
  278, // The Shawshank Redemption
  238, // The Godfather
  240, // The Godfather Part II
  424, // Schindler's List
  389, // 12 Angry Men
  680, // Pulp Fiction
  13, // Forrest Gump
  603, // The Matrix

  // filmfan - International Film
  129, // Spirited Away
  496243, // Parasite
  637, // Life Is Beautiful
  194, // Amélie
  598, // City of God
  1417, // Pan's Labyrinth

  // bingewatcher - Peak TV
  155, // The Dark Knight
  27205, // Inception
  157336, // Interstellar

  // scifi_jordan - Sci-Fi/Fantasy
  78, // Blade Runner
  438631, // Dune
  329865, // Arrival
  264660, // Ex Machina
  286217, // The Martian
];
```

**Step 3: Update TV_SHOW_IDS to include all unique shows**

Replace lines 152-164 with the complete list:

```typescript
/** TV Show TMDB IDs to seed (superset of all user shows). */
export const TV_SHOW_IDS = [
  // demo - Classic Cinema Buff
  1396, // Breaking Bad
  1398, // The Sopranos

  // filmfan - International Film
  93405, // Squid Game
  70523, // Dark

  // bingewatcher - Peak TV
  1399, // Game of Thrones
  66732, // Stranger Things
  2316, // The Office
  1668, // Friends

  // scifi_jordan - Sci-Fi/Fantasy
  121, // Doctor Who (Classic, 1963-1989)
  57243, // Doctor Who (Modern, 2005+)
  63639, // The Expanse
  42009, // Black Mirror
];
```

**Step 4: Add runtime validation function (defense-in-depth)**

Add after `getEffectiveTVShowIdsForUser` function (around line 383):

```typescript
/**
 * Validates that all user content IDs exist in the global ID arrays.
 * Call during seed to catch configuration mismatches early.
 *
 * @throws Error if any user movie/show ID is missing from MOVIE_IDS/TV_SHOW_IDS
 */
export function validateContentDistribution(): void {
  const movieIdSet = new Set(MOVIE_IDS);
  const showIdSet = new Set(TV_SHOW_IDS);

  for (const [email, config] of Object.entries(USER_CONTENT_DISTRIBUTION)) {
    for (const movieId of config.movieIds) {
      if (!movieIdSet.has(movieId)) {
        throw new Error(
          `Movie ID ${movieId} for ${email} not found in MOVIE_IDS`
        );
      }
    }
    for (const showId of config.showIds) {
      if (!showIdSet.has(showId)) {
        throw new Error(
          `Show ID ${showId} for ${email} not found in TV_SHOW_IDS`
        );
      }
    }
  }
}
```

**Step 5: Call validation in seed.ts (optional)**

In `prisma/seed.ts`, add at the start of the `main()` function:

```typescript
import { validateContentDistribution } from "./seed-config";

async function main() {
  // Validate configuration before seeding
  validateContentDistribution();

  // ... rest of seed logic
}
```

**Step 6: Verify changes compile**

Run: `pnpm run type-check`
Expected: No TypeScript errors

**Step 7: Commit**

```bash
git add prisma/seed-config.ts prisma/seed.ts
git commit -m "feat(seed): unique content per user with zero overlap

- Replace shared content with distinct themed collections per user
- Add validateContentDistribution() for early error detection
- Remove: Dilwale Dulhania Le Jayenge, Rick and Morty, Big Bang Theory,
  The Simpsons, How I Met Your Mother, The Witcher, Loki
- Add: Pulp Fiction, Forrest Gump, Matrix, Amélie, City of God,
  Pan's Labyrinth, Inception, Interstellar, Blade Runner, Dune,
  Arrival, Ex Machina, The Martian, The Sopranos, Squid Game, Dark,
  The Office, Friends, The Expanse, Black Mirror
- test@canoncore.com now has empty arrays for clean E2E slate"
```

---

## Task 2: Add unit test for content overlap detection

**Files:**

- Modify: `tests/unit/prisma/seed-config.test.ts`

**Step 1: Write failing test for movie overlap**

Add to `seed-config.test.ts` after the existing tests (around line 264):

```typescript
describe("USER_CONTENT_DISTRIBUTION uniqueness", () => {
  it("has no overlapping movie IDs between users", async () => {
    const config = await import("@/prisma/seed-config");
    const seen = new Set<number>();
    const duplicates: number[] = [];

    Object.values(config.USER_CONTENT_DISTRIBUTION).forEach((userConfig) => {
      userConfig.movieIds.forEach((id) => {
        if (seen.has(id)) {
          duplicates.push(id);
        }
        seen.add(id);
      });
    });

    expect(duplicates).toEqual([]);
  });

  it("has no overlapping show IDs between users", async () => {
    const config = await import("@/prisma/seed-config");
    const seen = new Set<number>();
    const duplicates: number[] = [];

    Object.values(config.USER_CONTENT_DISTRIBUTION).forEach((userConfig) => {
      userConfig.showIds.forEach((id) => {
        if (seen.has(id)) {
          duplicates.push(id);
        }
        seen.add(id);
      });
    });

    expect(duplicates).toEqual([]);
  });

  it("all user movie IDs exist in MOVIE_IDS", async () => {
    const config = await import("@/prisma/seed-config");
    const movieIdSet = new Set(config.MOVIE_IDS);
    const missingIds: number[] = [];

    Object.values(config.USER_CONTENT_DISTRIBUTION).forEach((userConfig) => {
      userConfig.movieIds.forEach((id) => {
        if (!movieIdSet.has(id)) {
          missingIds.push(id);
        }
      });
    });

    expect(missingIds).toEqual([]);
  });

  it("all user show IDs exist in TV_SHOW_IDS", async () => {
    const config = await import("@/prisma/seed-config");
    const showIdSet = new Set(config.TV_SHOW_IDS);
    const missingIds: number[] = [];

    Object.values(config.USER_CONTENT_DISTRIBUTION).forEach((userConfig) => {
      userConfig.showIds.forEach((id) => {
        if (!showIdSet.has(id)) {
          missingIds.push(id);
        }
      });
    });

    expect(missingIds).toEqual([]);
  });

  it("test user has empty content arrays", async () => {
    const config = await import("@/prisma/seed-config");
    const testConfig = config.USER_CONTENT_DISTRIBUTION["test@canoncore.com"];

    expect(testConfig.movieIds).toEqual([]);
    expect(testConfig.showIds).toEqual([]);
  });

  it("validateContentDistribution does not throw for valid config", async () => {
    const config = await import("@/prisma/seed-config");
    expect(() => config.validateContentDistribution()).not.toThrow();
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/prisma/seed-config.test.ts`
Expected: All tests pass (Task 1 already updated the config)

**Step 3: Commit**

```bash
git add tests/unit/prisma/seed-config.test.ts
git commit -m "test(seed): add uniqueness tests for content distribution"
```

---

## Task 3: Update E2E test data expectations

**Files:**

- Modify: `e2e/fixtures/google-drive.fixture.ts:158`
- Review: `e2e/journeys/google-drive/drive-media.spec.ts`

**Step 1: Review E2E dependencies on seed content**

The E2E tests use their own test user (created dynamically), NOT seed users. The only seed-specific reference is "Breaking Bad" in the E2E Drive fixture, which is for the E2E test account, not seed users.

**Review findings:**

- `drive-media.spec.ts` uses `TEST_ITEM_NAME = "Breaking Bad"` - this is for E2E test user, unaffected
- `global.setup.ts` protects "Breaking Bad" folder - this is E2E baseline data, unaffected
- Public profile E2E tests create fresh users, don't depend on seed data

**Step 2: No changes needed**

The E2E tests are isolated from seed data. They create their own test users and items.

**Step 3: Document this in the plan**

No E2E changes required - tests use dynamically created users, not seed users.

---

## Task 4: Verify seed runs successfully

**Step 1: Run the seed with the new configuration**

Run: `ALLOW_SEEDING=true pnpm prisma db seed`

Expected output should show:

- demo@canoncore.com with unique movies (Shawshank, Godfather series, etc.) and Breaking Bad, Sopranos
- filmfan@canoncore.com with international films (Spirited Away, Parasite, etc.) and Squid Game, Dark
- bingewatcher@canoncore.com with Nolan films and peak TV shows
- scifi_jordan with sci-fi films and Doctor Who, Expanse, Black Mirror
- test@canoncore.com with no content (empty)

**Step 2: Verify Explore page shows unique content**

Navigate to `http://localhost:3000/explore` and verify:

- No duplicate movie/show titles
- Each user's content matches their persona
- All items have artwork

---

## Task 5: Update integration test if needed

**Files:**

- Review: `tests/integration/seed/seed.test.ts`

**Step 1: Check existing seed integration tests**

The seed integration tests verify the seed mechanism works, not specific content. Review to confirm no hardcoded TMDB IDs that would break.

**Step 2: No changes expected**

Integration tests should continue to pass as they test seed functionality, not specific content.

Run: `pnpm run test:integration tests/integration/seed/seed.test.ts`
Expected: All tests pass

---

## Summary of Changes

| Category              | Action                                               | Files                                   |
| --------------------- | ---------------------------------------------------- | --------------------------------------- |
| **Config**            | Update content distribution, add validation function | `prisma/seed-config.ts`                 |
| **Seed**              | Call validateContentDistribution() on startup        | `prisma/seed.ts`                        |
| **Unit Tests**        | Add overlap detection + validation tests             | `tests/unit/prisma/seed-config.test.ts` |
| **Integration Tests** | No changes                                           | —                                       |
| **E2E Tests**         | No changes                                           | —                                       |

## Tests to Run After Implementation

```bash
# Unit tests
pnpm run test:unit tests/unit/prisma/seed-config.test.ts

# Integration tests (if seed integration exists)
pnpm run test:integration tests/integration/seed/seed.test.ts

# Full test suite to catch any regressions
pnpm run test
```
