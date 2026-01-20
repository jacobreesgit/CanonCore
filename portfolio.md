# Portfolio Seeding Plan

## Overview

This document details the seeding modifications needed to capture compelling portfolio screenshots for CanonCore. The goal is to showcase all features with realistic data across multiple users.

## Current State Analysis

### Existing Seed Configuration

- **Users**: 2 (demo@canoncore.com, test@canoncore.com)
- **Movies**: 10 (Shawshank, Godfather I/II, Schindler's List, 12 Angry Men, Spirited Away, DDLJ, Parasite, Life Is Beautiful, Dark Knight)
- **TV Shows**: 11 (Doctor Who Classic/Modern, Breaking Bad, Game of Thrones, Rick and Morty, Big Bang Theory, Simpsons, Stranger Things, HIMYM, Witcher, Loki)
- **Profile Pictures**: None
- **Public Profiles**: No configuration
- **Usernames**: Not set

### Missing for Portfolio

1. No user profile pictures (avatars)
2. No public profile configuration (usernames, public flags)
3. Only 2 users - insufficient for Explore page variety
4. No user hero/banner images
5. Content not distributed for visual variety in screenshots

> **Schema Note**: The User model does NOT have a `bio` field. This plan excludes bio text. If bios are desired, a migration would be needed to add `bio String?` to the User model.

---

## Required Seed Modifications

### 1. User Configuration Updates

**New SEED_USERS array** (5 users for Explore page variety):

```typescript
export const SEED_USERS = [
  {
    email: "demo@canoncore.com",
    name: "Demo User",
    username: "demo",
    isPublic: true,
    // Images downloaded at seed time and stored as Bytes
    avatarSeed: "demo-avatar", // Lorem Picsum seed for reproducibility
    heroSeed: "demo-hero",
  },
  {
    email: "filmfan@canoncore.com",
    name: "Sarah Mitchell",
    username: "filmfan",
    isPublic: true,
    avatarSeed: "filmfan-avatar",
    heroSeed: "filmfan-hero",
  },
  {
    email: "bingewatcher@canoncore.com",
    name: "Alex Chen",
    username: "bingewatcher",
    isPublic: true,
    avatarSeed: "bingewatcher-avatar",
    heroSeed: "bingewatcher-hero",
  },
  {
    email: "scifi@canoncore.com",
    name: "Jordan Taylor",
    username: "scifi_jordan",
    isPublic: true,
    avatarSeed: "scifi-avatar",
    heroSeed: "scifi-hero",
  },
  {
    email: "test@canoncore.com",
    name: "Test User",
    username: "testuser",
    isPublic: false, // Private for testing
    avatarSeed: null,
    heroSeed: null,
  },
];
```

### 2. Content Distribution Per User

To make the Explore page visually interesting with varied collections:

| User         | Movies                                                                       | TV Shows                                    | Theme             |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------------- | ----------------- |
| demo         | All 10                                                                       | Breaking Bad, Stranger Things, Loki         | Varied mainstream |
| filmfan      | Shawshank, Godfather I/II, Schindler's List, 12 Angry Men, Life Is Beautiful | None                                        | Classic drama     |
| bingewatcher | Dark Knight, Spirited Away                                                   | All 11 shows                                | TV-focused        |
| scifi_jordan | None                                                                         | Doctor Who (both), Witcher, Stranger Things | Sci-fi/Fantasy    |
| testuser     | 3 random                                                                     | 2 random                                    | Minimal (testing) |

**New config options**:

```typescript
export const USER_CONTENT_DISTRIBUTION = {
  "demo@canoncore.com": {
    movieIds: MOVIE_IDS,
    showIds: [1396, 66732, 84958], // Breaking Bad, Stranger Things, Loki
  },
  "filmfan@canoncore.com": {
    movieIds: [278, 238, 240, 424, 389, 637], // Shawshank, Godfather I/II, Schindler's, 12 Angry Men, Life Is Beautiful
    showIds: [],
  },
  "bingewatcher@canoncore.com": {
    movieIds: [155, 129], // Dark Knight, Spirited Away
    showIds: TV_SHOW_IDS,
  },
  "scifi@canoncore.com": {
    movieIds: [],
    showIds: [121, 57243, 71912, 66732], // Doctor Who x2, Witcher, Stranger Things
  },
  "test@canoncore.com": {
    movieIds: [278, 155, 129], // Shawshank, Dark Knight, Spirited Away
    showIds: [1396, 60625], // Breaking Bad, Rick and Morty
  },
};
```

### 3. Progress Simulation Per User

Different progress states for visual variety:

| User         | Progress State | Purpose                       |
| ------------ | -------------- | ----------------------------- |
| demo         | Mixed (25-75%) | Shows progress bars in action |
| filmfan      | High (80-100%) | Shows completed collections   |
| bingewatcher | Low (10-30%)   | Shows "Continue Watching"     |
| scifi_jordan | Mid (40-60%)   | Shows mid-progress            |
| testuser     | None (0%)      | Fresh library                 |

**New config**:

```typescript
export const USER_PROGRESS_RANGES = {
  "demo@canoncore.com": { min: 0.25, max: 0.75 },
  "filmfan@canoncore.com": { min: 0.8, max: 1.0 },
  "bingewatcher@canoncore.com": { min: 0.1, max: 0.3 },
  "scifi@canoncore.com": { min: 0.4, max: 0.6 },
  "test@canoncore.com": { min: 0, max: 0 },
};
```

### 4. Seed Assets - Lorem Picsum

User profile images sourced from Lorem Picsum API. Uses seeded URLs for reproducible, consistent images across seed runs.

> **Note**: Unsplash Source (`source.unsplash.com`) was deprecated in 2021 and has been sunset. Lorem Picsum provides a simple, reliable alternative with seed-based consistency.

**Lorem Picsum URLs**:

```typescript
// Avatars - square photos with seed for consistency
// Format: https://picsum.photos/seed/{seed}/{width}/{height}
const AVATAR_URLS = {
  "demo@canoncore.com": "https://picsum.photos/seed/demo-avatar/400/400",
  "filmfan@canoncore.com": "https://picsum.photos/seed/filmfan-avatar/400/400",
  "bingewatcher@canoncore.com":
    "https://picsum.photos/seed/bingewatcher-avatar/400/400",
  "scifi@canoncore.com": "https://picsum.photos/seed/scifi-avatar/400/400",
};

// Heroes - wide landscape photos for banner
const HERO_URLS = {
  "demo@canoncore.com": "https://picsum.photos/seed/demo-hero/1920/400",
  "filmfan@canoncore.com": "https://picsum.photos/seed/filmfan-hero/1920/400",
  "bingewatcher@canoncore.com":
    "https://picsum.photos/seed/bingewatcher-hero/1920/400",
  "scifi@canoncore.com": "https://picsum.photos/seed/scifi-hero/1920/400",
};
```

**Implementation**: Download images during seed and store as `Bytes` in User record (schema uses binary storage, not URLs). The seed parameter ensures identical images across seed runs.

```typescript
/**
 * Downloads image from Lorem Picsum and returns as Buffer.
 */
async function downloadProfileImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}
```

### 5. Folder Structure Per User

Each user gets the same hierarchical structure but with their assigned content:

```
[User's Library]
├── Movies/
│   ├── [Movie 1]/
│   │   └── [movie file placeholder]
│   ├── [Movie 2]/
│   └── ...
└── TV Shows/
    ├── [Show 1]/
    │   ├── Season 1/
    │   │   ├── Episode 1/
    │   │   └── ...
    │   └── Season 2/
    └── ...
```

### 6. Required Code Changes

#### seed-config.ts additions:

```typescript
// Add to existing file

/** User profile configuration for seeding. */
export interface SeedUserConfig {
  email: string;
  name: string;
  username?: string;
  isPublic?: boolean;
  /** Lorem Picsum seed for avatar image (null = no avatar). */
  avatarSeed?: string | null;
  /** Lorem Picsum seed for hero banner (null = no hero). */
  heroSeed?: string | null;
}

/** Content distribution by user email. */
export interface UserContentConfig {
  movieIds: number[];
  showIds: number[];
}

/** Progress simulation range (0-1). */
export interface ProgressRange {
  min: number;
  max: number;
}

/** Avatar image dimensions. */
export const AVATAR_SIZE = { width: 400, height: 400 };

/** Hero banner dimensions. */
export const HERO_SIZE = { width: 1920, height: 400 };

/**
 * Builds Lorem Picsum URL for reproducible images.
 */
export function buildPicsumUrl(
  seed: string,
  width: number,
  height: number
): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

export const SEED_USERS: SeedUserConfig[] = [
  // ... as defined above
];

export const USER_CONTENT_DISTRIBUTION: Record<string, UserContentConfig> = {
  // ... as defined above
};

export const USER_PROGRESS_RANGES: Record<string, ProgressRange> = {
  // ... as defined above
};
```

#### seed.ts modifications:

1. **Add image download helper**:

```typescript
/**
 * Downloads image from URL and returns as Buffer with MIME type.
 */
async function downloadImage(
  url: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mime: contentType };
  } catch {
    return null;
  }
}
```

2. **Update user creation** to include new fields (schema uses Bytes, not URLs):

```typescript
// Download profile images if seeds are provided
let avatarData: { buffer: Buffer; mime: string } | null = null;
let heroData: { buffer: Buffer; mime: string } | null = null;

if (user.avatarSeed) {
  const avatarUrl = buildPicsumUrl(
    user.avatarSeed,
    AVATAR_SIZE.width,
    AVATAR_SIZE.height
  );
  avatarData = await downloadImage(avatarUrl);
}

if (user.heroSeed) {
  const heroUrl = buildPicsumUrl(
    user.heroSeed,
    HERO_SIZE.width,
    HERO_SIZE.height
  );
  heroData = await downloadImage(heroUrl);
}

await prisma.user.upsert({
  where: { email: user.email },
  update: {},
  create: {
    email: user.email,
    name: user.name,
    username: user.username,
    isPublic: user.isPublic ?? false,
    // Store as Bytes with MIME type (schema requirement)
    image: avatarData?.buffer ?? null,
    imageMime: avatarData?.mime ?? null,
    heroImage: heroData?.buffer ?? null,
    heroImageMime: heroData?.mime ?? null,
    passwordHash: hashedPassword,
  },
});
```

3. **Filter content per user** using `USER_CONTENT_DISTRIBUTION`:

```typescript
const userConfig = USER_CONTENT_DISTRIBUTION[user.email];
const movieIds = userConfig?.movieIds ?? getEffectiveMovieIds();
const showIds = userConfig?.showIds ?? getEffectiveTVShowIds();
```

4. **Apply progress ranges** using `USER_PROGRESS_RANGES`:

```typescript
const progressRange = USER_PROGRESS_RANGES[user.email];
const progress = progressRange
  ? progressRange.min + Math.random() * (progressRange.max - progressRange.min)
  : Math.random();
```

---

## Screenshot Capture Sequence

After seeding, the Playwright script should capture in this order:

| #   | Screenshot         | User    | View/State                    |
| --- | ------------------ | ------- | ----------------------------- |
| 1   | hero.png           | demo    | Grid view, all items visible  |
| 2   | tree-view.png      | demo    | Tree view expanded            |
| 3   | item-detail.png    | demo    | Dark Knight detail page       |
| 4   | spotlight.png      | demo    | Search "dark" results         |
| 5   | tmdb-wizard.png    | demo    | Add item, search "inception"  |
| 6   | settings.png       | demo    | Google Drive tab              |
| 7   | grid-view.png      | demo    | Inside Movies folder          |
| 8   | mobile-view.png    | demo    | 390x844 viewport              |
| 9   | explore.png        | (none)  | All 4 public profiles visible |
| 10  | public-profile.png | filmfan | Classic cinema collection     |
| 11  | media-player.png   | demo    | Video playing                 |

---

## Implementation Checklist

### Phase 1: Config Updates

- [ ] Add `SeedUserConfig` interface to seed-config.ts
- [ ] Update `SEED_USERS` array with 5 users
- [ ] Add `USER_CONTENT_DISTRIBUTION` mapping
- [ ] Add `USER_PROGRESS_RANGES` mapping
- [ ] Add `buildPicsumUrl` helper and size constants

### Phase 2: Multi-User Drive Strategy

- [ ] Decide on Drive approach (see notes below)
- [ ] Option A: Shared test account - all users share same Drive connection
- [ ] Option B: Demo user only - only demo@canoncore.com gets Drive sync
- [ ] Update seed logic based on chosen approach

> **Note**: Current seed creates ONE Drive connection for demo user only. For portfolio screenshots, Option B (demo user only) is simplest and matches current behavior. Other users can have content without Drive sync.

### Phase 3: Seed Script Updates

- [ ] Add `downloadImage()` helper function
- [ ] Update user creation to download and store images as Bytes
- [ ] Include `imageMime` and `heroImageMime` fields
- [ ] Add content filtering per user
- [ ] Add progress range application per user

### Phase 4: Database Schema Check

- [ ] Verify User model has: username, isPublic, image, imageMime, heroImage, heroImageMime
- [ ] All fields exist in current schema - no migration needed

### Phase 5: Testing

- [ ] Run seed with new config
- [ ] Verify 5 users created with correct profiles
- [ ] Verify avatars/heroes display correctly (check /api/user/avatar, /api/user/hero)
- [ ] Verify content distributed correctly
- [ ] Verify progress bars show varied states
- [ ] Verify Explore page shows 4 public profiles

### Phase 6: Screenshots

- [ ] Run Playwright capture script
- [ ] Review all 11 screenshots
- [ ] Move to public/images/projects/canoncore/

> **Note on media-player.png**: Screenshot #11 requires a real video file in Google Drive. The seed creates placeholder media files with `driveFileId: null`. Either upload a test video to the demo user's Drive folder manually, or skip this screenshot.

---

## Notes

- The test user remains private to ensure only 4 profiles appear on Explore
- Progress simulation uses random within ranges for natural variation
- Avatar/hero images are downloaded from Lorem Picsum at seed time and stored as binary (`Bytes`) in the database
- TMDB metadata (posters, backdrops) is fetched automatically - only profile images need sourcing
- Lorem Picsum seed strings ensure reproducible images across seed runs
- Schema stores images as `Bytes` with separate MIME type fields (`imageMime`, `heroImageMime`)
- Only demo user gets Google Drive sync; other users have local-only content (sufficient for screenshots)
