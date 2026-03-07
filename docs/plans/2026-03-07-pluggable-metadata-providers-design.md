# Pluggable Metadata Provider Architecture

**Date:** 2026-03-07
**Status:** Design approved
**Scope:** Protocol-first metadata provider system with official + community source store

---

## Overview

Replace the hardcoded TMDB-only metadata system with a pluggable provider architecture. Every provider — official or community — implements the same protocol. Official providers run in-process (TypeScript). Community providers run as external HTTP services, discoverable via a Source Store.

**Motivation:**
- Support content types beyond movies/TV (music, audio dramas, etc.)
- Enrich existing content from multiple sources (OMDb ratings, Fanart.tv images)
- Enable community-contributed niche providers (Big Finish, Fandom wikis)
- Position CanonCore as a platform, not just an app

**Official providers (v1):** TMDB, OMDb, MusicBrainz
**Community providers (v2+):** Big Finish, Fandom wikis, niche sources via Source Store

---

## 1. Protocol Specification (CMPP)

The CanonCore Metadata Provider Protocol defines the contract every provider must fulfil. Inspired by Stremio's addon protocol, Audiobookshelf's custom provider spec, and LSP/MCP patterns.

### 1.1 Manifest

```typescript
interface ProviderManifest {
  id: string                    // "tmdb", "omdb", "community.bigfinish"
  name: string                  // "The Movie Database"
  version: string               // semver
  description: string
  icon?: string                 // URL to provider icon
  website?: string              // Provider homepage

  contentTypes: ContentType[]   // ["movie", "tv", "book", "music", "audio-drama"]

  capabilities: {
    search: boolean
    details: boolean
    images: boolean
    seasons?: boolean           // Supports hierarchical content (TV seasons/episodes)
  }

  artworkTypes?: ArtworkType[]  // ["poster", "backdrop", "logo", "still", "cover"]

  auth?: {
    type: "api-key" | "oauth" | "none"
    instructions?: string
  }
}
```

### 1.2 Content Types

```typescript
type ContentType =
  | "movie"        // TMDB, OMDb
  | "tv"           // TMDB, OMDb
  | "book"         // Future (Google Books, OpenLibrary)
  | "music"        // MusicBrainz, Discogs
  | "audio-drama"  // MusicBrainz (Big Finish), community providers
  | "podcast"      // Future
  | "game"         // Future (IGDB)
```

### 1.3 Artwork Types

```typescript
type ArtworkType = "poster" | "backdrop" | "logo" | "still" | "cover"
```

### 1.4 Search

```typescript
interface SearchRequest {
  query: string
  contentType?: ContentType
  params?: Record<string, string>
}

interface SearchResult {
  id: string                    // Provider-specific ID
  title: string
  contentType: ContentType
  year?: string
  description?: string
  creator?: string              // Simple string for search results: "Christopher Nolan"
  thumbnail?: string            // Full URL
  badges?: string[]             // ["HD", "2024", "Series 5"]
}
```

### 1.5 Details

```typescript
interface DetailRequest {
  id: string
  contentType: ContentType
}

interface DetailResult {
  id: string
  title: string
  contentType: ContentType
  description?: string
  year?: string
  tagline?: string
  contentRating?: string        // "PG-13", "TV-MA", "Explicit"
  duration?: number             // seconds
  language?: string

  genres?: string[]
  tags?: string[]

  credits?: Credit[]
  rating?: { source: string; value: string }[]
  externalIds?: Record<string, string>  // { imdb: "tt1234", musicbrainz: "uuid" }

  // Artwork (best single image per type, full URLs)
  poster?: string
  backdrop?: string
  logo?: string

  // Hierarchical content (TV seasons, album tracks)
  children?: ChildItem[]

  // Provider-specific extended data
  extra?: Record<string, unknown>
}

interface Credit {
  name: string
  role: string        // "director", "writer", "actor", "artist", "narrator"
  character?: string  // "Walter White"
  thumbnail?: string  // Profile image URL
}

interface ChildItem {
  id: string
  title: string
  number?: number     // Season 1, Episode 3, Track 5
  thumbnail?: string
  children?: ChildItem[]  // Recursive: season -> episodes
}
```

### 1.6 Images

```typescript
interface ImageRequest {
  id: string
  contentType: ContentType
  artworkType: ArtworkType
}

interface ImageResult {
  images: ArtworkImage[]
}

interface ArtworkImage {
  url: string         // Full URL (not paths)
  width: number
  height: number
  language?: string
  voteAverage?: number
  voteCount?: number
}
```

### 1.7 Transport

The protocol is transport-agnostic:

- **Official providers (in-process):** TypeScript class implementing the interface. Zero HTTP overhead.
- **Community providers (remote):** HTTP server at a URL:
  - `GET /manifest.json` -> `ProviderManifest`
  - `GET /search?query=X&contentType=Y` -> `SearchResult[]`
  - `GET /details/:contentType/:id` -> `DetailResult`
  - `GET /images/:contentType/:id/:artworkType` -> `ImageResult`

A `RemoteMetadataProvider` adapter wraps any URL into the TypeScript interface. From CanonCore's perspective, all providers look identical.

---

## 2. Provider Architecture (Internal)

### 2.1 Provider Interface

```typescript
interface MetadataProvider {
  manifest: ProviderManifest
  search(request: SearchRequest): Promise<SearchResult[]>
  getDetails(request: DetailRequest): Promise<DetailResult | null>
  getImages(request: ImageRequest): Promise<ImageResult>
}
```

### 2.2 File Structure

```
lib/
  metadata/
    protocol.ts              # All shared types
    registry.ts              # Provider registry
    remote-provider.ts       # RemoteMetadataProvider adapter
    image-utils.ts           # resolveImageUrl() — universal URL builder
    providers/
      tmdb/
        manifest.ts
        provider.ts          # TMDBProvider implements MetadataProvider
        client.ts            # Refactored from lib/tmdb-client.ts
        mapper.ts            # TMDB API responses -> protocol types
      omdb/
        manifest.ts
        provider.ts
        client.ts
        mapper.ts
      musicbrainz/
        manifest.ts
        provider.ts
        client.ts            # MusicBrainz API + Cover Art Archive
        mapper.ts
```

### 2.3 Provider Registry

```typescript
class ProviderRegistry {
  private providers: Map<string, MetadataProvider>

  register(provider: MetadataProvider): void
  get(id: string): MetadataProvider | undefined
  getAll(): MetadataProvider[]
  getByContentType(type: ContentType): MetadataProvider[]

  // Community providers
  registerRemote(url: string): Promise<void>
  removeRemote(id: string): void
}
```

### 2.4 RemoteMetadataProvider Adapter

```typescript
class RemoteMetadataProvider implements MetadataProvider {
  constructor(private baseUrl: string, public manifest: ProviderManifest) {}

  async search(req: SearchRequest): Promise<SearchResult[]> {
    const params = new URLSearchParams({ query: req.query })
    if (req.contentType) params.set("contentType", req.contentType)
    const res = await fetch(`${this.baseUrl}/search?${params}`)
    return res.json()  // Validated with Zod before use
  }

  async getDetails(req: DetailRequest): Promise<DetailResult | null> {
    const res = await fetch(`${this.baseUrl}/details/${req.contentType}/${req.id}`)
    return res.json()
  }

  async getImages(req: ImageRequest): Promise<ImageResult> {
    const res = await fetch(
      `${this.baseUrl}/images/${req.contentType}/${req.id}/${req.artworkType}`
    )
    return res.json()
  }
}
```

### 2.5 Image URL Resolution

A single `resolveImageUrl()` replaces all `getTmdbPosterUrl`, `getTmdbBackdropUrl`, `getTmdbLogoUrl` calls:

```typescript
function resolveImageUrl(
  value: string | null,
  type: "poster" | "backdrop" | "logo" | "still",
  size?: string
): string | null {
  if (!value) return null
  if (value.startsWith("http")) return value  // Full URL (new providers)
  if (value.startsWith("/")) {
    // TMDB legacy path
    const sizeMap = { poster: "w500", backdrop: "original", logo: "original", still: "w300" }
    return `https://image.tmdb.org/t/p/${size ?? sizeMap[type]}${value}`
  }
  return null
}
```

---

## 3. Database Schema Changes

### 3.1 Prisma Schema

Rename TMDB-branded fields using `@map()` (zero migration risk, DB columns unchanged):

```prisma
model Item {
  // RENAMED via @map (DB columns stay the same)
  metadataId        Int?      @map("tmdbId")
  metadataProvider  String?   // NEW - "tmdb", "omdb", "musicbrainz"
  mediaType         String?   @map("tmdbType")
  posterPath        String?   @map("tmdbPosterPath")
  backdropPath      String?   @map("tmdbBackdropPath")
  logoPath          String?   @map("tmdbLogoPath")
  dominantColour    String?   // Already provider-agnostic

  // RENAMED display preferences
  showTagline          Boolean @default(false) @map("tmdbShowTagline")
  showMetadata         Boolean @default(false) @map("tmdbShowMetadata")
  showGenres           Boolean @default(false) @map("tmdbShowGenres")
  showCast             Boolean @default(false) @map("tmdbShowCast")
  showProviders        Boolean @default(false) @map("tmdbShowProviders")
  showVideos           Boolean @default(false) @map("tmdbShowVideos")
  showRecommendations  Boolean @default(false) @map("tmdbShowRecommendations")

  // NEW columns
  metadataExtra     Json?     // Provider-specific data (OMDb ratings, MusicBrainz labels)
  externalIds       Json?     // { imdb: "tt1234", musicbrainz: "uuid" }
}
```

### 3.2 User Metadata Sources

```prisma
model UserMetadataSource {
  id          String   @id @default(cuid())
  userId      String
  providerId  String   // "tmdb", "community.bigfinish", or custom URL hash
  url         String?  // null for official built-in providers
  apiKey      String?  // encrypted, for providers requiring auth
  enabled     Boolean  @default(true)
  priority    Int      @default(0)  // lower = higher priority
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, providerId])
}
```

### 3.3 Migration

```sql
ALTER TABLE "Item" ADD COLUMN "metadataProvider" TEXT;
ALTER TABLE "Item" ADD COLUMN "metadataExtra" JSONB;
ALTER TABLE "Item" ADD COLUMN "externalIds" JSONB;

-- Backfill existing items
UPDATE "Item" SET "metadataProvider" = 'tmdb' WHERE "tmdbId" IS NOT NULL;
```

---

## 4. Provider-Agnostic Wizard & UI

### 4.1 Search Flow

The current `MediaSearchCombobox` becomes a multi-provider search:

- Dropdown filters by provider or "All" (default)
- "All" fires `search()` across all enabled providers in parallel
- Results grouped by provider with icon + name as section headers
- Each result shows provider badges (year, type, rating)

### 4.2 Wizard Steps (Capability-Driven)

Steps derived from the provider's manifest, not hardcoded:

```typescript
function getWizardSteps(manifest: ProviderManifest): WizardStep[] {
  const steps: WizardStep[] = ["text"]
  if (manifest.capabilities.images) {
    const artwork = manifest.artworkTypes ?? []
    if (artwork.includes("poster"))   steps.push("poster")
    if (artwork.includes("backdrop")) steps.push("backdrop")
    if (artwork.includes("logo"))     steps.push("logo")
    if (artwork.includes("still"))    steps.push("still")
  }
  steps.push("summary")
  return steps
}
```

Examples:
- **TMDB movie:** text -> poster -> backdrop -> logo -> summary
- **TMDB episode:** text -> still -> summary
- **OMDb movie:** text -> summary (single poster URL, no gallery)
- **MusicBrainz release:** text -> poster -> summary (CAA front cover only)

### 4.3 Wizard Refactor

| Current | New |
|---|---|
| `useTMDBWizard` | `useMetadataWizard` |
| `TMDBWizardData` | `MetadataWizardData` |
| `TMDBWizardResult` | `MetadataWizardResult` (adds `providerId`) |
| `tmdb-wizard.tsx` | `metadata-wizard.tsx` |
| `getImagesAction()` | `provider.getImages()` |

The generic `useWizardMachine<TStep, TData>` hook already exists and is step-agnostic.

### 4.4 Server Actions

```typescript
// lib/metadata-actions.ts (replaces tmdb-actions.ts)

searchMetadataAction(query, providerId?)
getMetadataDetailsAction(providerId, contentType, id)
getMetadataImagesAction(providerId, contentType, id, artworkType)
applyMetadataAction(itemId, providerId, contentType, id, options)
```

### 4.5 TV/Hierarchical Content Picker

The TV picker (`components/items/wizards/tv-picker/`) becomes a generic "Children Picker" that renders whatever hierarchy the provider returns via `DetailResult.children[]`. Works for TV seasons/episodes, album tracks, book series/volumes.

### 4.6 Detail Page

- Display toggles are provider-agnostic (`showCast`, `showGenres`, etc.)
- Toggles are capability-driven: only show toggles for sections the item's provider supports
- Provider-specific sections (TMDB videos, OMDb ratings, MusicBrainz tracks) render from `metadataExtra`
- Small provider badge: "Metadata from TMDB" / "Metadata from MusicBrainz"

### 4.7 Display Options (Capability-Driven)

The 7 display toggles (showCast, showProviders, showVideos, etc.) only appear when the item's provider supports that section. MusicBrainz has no "watch providers" or "videos", so those toggles are hidden.

---

## 5. Source Store (Community Providers)

### 5.1 Architecture

```
CanonCore App  --fetch-->  Source Store Registry (GitHub JSON)
       |
       | user enables source
       v
RemoteProvider --HTTP-->  Community Provider (Vercel/Cloudflare/etc)
adapter                   GET /manifest.json
                          GET /search?query=X
                          GET /details/:type/:id
                          GET /images/:type/:id/:artworkType
```

### 5.2 Registry

GitHub-hosted JSON (like Obsidian's `community-plugins.json`):

```json
[
  {
    "id": "community.bigfinish",
    "name": "Big Finish",
    "description": "Doctor Who audio dramas, Torchwood, and more",
    "url": "https://bigfinish-provider.example.com",
    "icon": "https://bigfinish-provider.example.com/icon.png",
    "contentTypes": ["audio-drama"],
    "maintainer": "community-username",
    "verified": true
  }
]
```

New sources submitted via PR, reviewed, merged.

### 5.3 Security (Remote Providers)

- 5-second timeout on all remote calls
- 1MB max response size
- Zod schema validation on all responses
- Server-side calls only (server actions, not browser)
- Rate-limiting outbound calls per provider

### 5.4 Sources Page (Sidebar)

Dedicated page replacing pinned items in the sidebar:

```
Sidebar
  Home
  Search
  My Items        (simple link, no collapsible children)
  Explore
  Sources         (new dedicated page)
  Get Help        (collapsible)
  Legal           (collapsible)
```

Sources page has two tabs:
- **My Sources** -- enabled providers, priority ordering (drag-to-reorder), API key management
- **Browse Store** -- community sources with search, categories, verified badges, install button

---

## 6. Sidebar Changes

- **Remove:** Pinned items as collapsible children of "My Items"
- **Add:** Sources as top-level nav item
- **My Items** becomes a simple link (no chevron/collapsible)

---

## 7. Seeding Changes

### 7.1 Seed Config

```typescript
// seed-config.ts
interface SeedItem {
  provider: "tmdb" | "omdb" | "musicbrainz"
  id: string
  contentType: ContentType
}

const SEED_ITEMS: SeedItem[] = [
  { provider: "tmdb", id: "278", contentType: "movie" },    // Shawshank
  { provider: "tmdb", id: "238", contentType: "movie" },    // Godfather
  // ... existing movies/shows ...
]
```

### 7.2 Seed Script

- Imports from `lib/metadata/providers/tmdb/client.ts` instead of duplicating TMDB types and `tmdbFetch()`
- Writes `metadataProvider: "tmdb"` on every seeded item
- Uses renamed Prisma fields (`metadataId`, `posterPath`, etc.)
- Remove `USER_PINNED_ITEMS` config (pinned items removed from sidebar)
- Remove duplicate TMDB types/helpers (~150 lines of dead code)

---

## 8. Gap Inventory

### 8.1 Codebase Refactor Scope

| Category | Files | Change Type |
|---|---|---|
| Prisma schema | 1 | `@map()` renames + 3 new columns |
| Library files (lib/) | 7 | Refactor into provider modules |
| Components | 25+ | Rename + logic changes |
| Hooks | 2 | Provider-agnostic form hooks |
| Tests (unit + integration) | 12+ | Rewrite against new interfaces |
| E2E tests | 5 | Update selectors/flows |
| Storybook | 15+ stories + 3 mocks | Provider-agnostic mock layer |
| Seed | 2 | Provider-aware config + imports |
| Scripts | 1 | Use `resolveImageUrl()` |
| Config | 2 | Add image domains + env vars |
| Documentation | 2 | Reflect multi-provider |
| **Total** | **~96 files, ~7,000+ lines** | |

### 8.2 Specific Gaps to Address

1. **Fork/clone** -- `fork-actions.ts` copies all metadata fields. Must copy `metadataProvider`, `metadataExtra`, `externalIds` alongside renamed fields.

2. **JSON-LD** -- Public item pages generate schema.org structured data from TMDB metadata. Must become provider-aware (different schema types: Movie, MusicRecording, etc.).

3. **`next.config.mjs`** -- Remote image patterns currently only allow `image.tmdb.org`. Must add `coverartarchive.org`, `img.omdbapi.com`, and strategy for community provider image domains.

4. **TV picker** -- Becomes generic "Children Picker" rendering `DetailResult.children[]`. No longer TMDB-specific season/episode APIs.

5. **Image URL resolution** -- Items store TMDB paths (`/abc123.jpg`) not full URLs. `resolveImageUrl()` handles both: paths (TMDB legacy) and full URLs (new providers).

6. **Storybook** -- `.storybook/lib/tmdb.ts` browser-safe client needs provider-agnostic mock layer.

7. **`reextract-colours.ts`** -- Must use `resolveImageUrl()` instead of `getTmdbBackdropUrl()`.

8. **CI/CD** -- `.github/workflows/seed.yml` passes `TMDB_API_KEY`. Needs additional provider keys when those are used in seeding.

9. **Display toggles** -- Capability-driven: only show toggles for sections the item's provider supports.

10. **Rate limit keys** -- `tmdbSearch`, `tmdbPreview`, `tmdbImages` become provider-agnostic: `metadata:search`, `metadata:preview`, `metadata:images`.

### 8.3 Already Provider-Agnostic (No Changes Needed)

- Spotlight search (only uses poster paths for thumbnails)
- Homepage shelf queries (only uses poster paths)
- Playlists (reference items, not metadata)
- Item context menus (no metadata-specific actions)
- Account deletion (cascades regardless of provider)
- Caching layer (provider-transparent)

---

## 9. Implementation Phases

### Phase 1 -- Foundation

- Define `protocol.ts` with all shared types
- Create `ProviderRegistry`
- Build `TMDBProvider` (refactor existing code into provider pattern)
- All existing TMDB functionality passes through the new provider (zero behaviour change)
- DB migration: add `metadataProvider`, `metadataExtra`, `externalIds`
- Prisma schema: `@map()` renames on all `tmdb*` fields
- Backfill `metadataProvider = 'tmdb'` for existing items
- `resolveImageUrl()` replaces all TMDB URL builders
- Codebase-wide rename (~96 files, mechanical with Prisma types as guardrails)

### Phase 2 -- OMDb + MusicBrainz Providers

- Implement `OMDbProvider` (client, mapper, provider)
- Implement `MusicBrainzProvider` (client, mapper, provider + Cover Art Archive)
- Register all three in the registry
- Provider-agnostic server actions (`metadata-actions.ts`) replace `tmdb-actions.ts`

### Phase 3 -- Provider-Agnostic Wizard

- Multi-provider search combobox with grouped results
- `metadata-wizard.tsx` driven by manifest capabilities
- `useMetadataWizard` replaces `useTMDBWizard`
- Generic children picker replaces TV picker
- Detail page sections render from `metadataExtra` + capability-driven toggles
- Provider badge on detail pages

### Phase 4 -- Sources Page + Source Store

- `UserMetadataSource` Prisma model
- Sources page (`app/(app)/sources/page.tsx`) with My Sources + Browse Store tabs
- `RemoteMetadataProvider` adapter
- Source Store registry (GitHub JSON)
- Sidebar: add Sources, remove pinned items
- API key management UI
- Priority ordering (drag-to-reorder)

### Phase 5 -- Community Protocol & Docs

- Publish protocol spec as documentation
- Provider starter template (TypeScript scaffolding)
- Validation tool (test implementation against spec)
- First community provider: Big Finish (reference implementation)

---

## 10. Provider API Reference

### 10.1 TMDB

- **Content types:** movie, tv
- **Capabilities:** search, details, images, seasons
- **Artwork:** poster, backdrop, logo, still
- **Auth:** API key (free, TMDB_API_KEY env var)
- **Rate limit:** ~40 req/s
- **Image CDN:** `image.tmdb.org/t/p/{size}{path}`
- **Unique data:** cast with character names + profile images, watch providers, YouTube trailers, content ratings

### 10.2 OMDb

- **Content types:** movie, tv
- **Capabilities:** search, details
- **Artwork:** poster (single URL only, no gallery)
- **Auth:** API key (free tier: 1,000 req/day)
- **Unique data:** Multi-source ratings (IMDb, Rotten Tomatoes, Metacritic), Awards, BoxOffice, Director/Writer/Actors as strings
- **Cross-reference:** Returns `imdbID` (links to TMDB via external IDs)

### 10.3 MusicBrainz

- **Content types:** music, audio-drama
- **Capabilities:** search, details, images
- **Artwork:** poster (via Cover Art Archive front cover, thumbnails at 250/500/1200px)
- **Auth:** none (1 req/s rate limit, requires User-Agent header)
- **Entities:** release, release-group, recording, artist
- **Unique data:** artist-credit with join phrases, label info, track listings, genres/tags with vote counts, barcode
- **Cover Art Archive:** `coverartarchive.org/release/{mbid}/front` (separate service, no rate limit)
- **Big Finish:** Available as a label (`dd10cb9b-f1cd-4d9c-8b6c-1a5082fe6d43`)

---

## 11. Research References

- [abs-agg](https://github.com/Vito0912/abs-agg) -- Audiobookshelf metadata aggregator with provider pattern
- [Audiobookshelf custom provider spec](https://github.com/advplyr/audiobookshelf/blob/master/custom-metadata-provider-specification.yaml)
- [Stremio addon protocol](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/protocol.md)
- [Obsidian plugin registry](https://github.com/obsidianmd/obsidian-releases)
- [Payload CMS plugin architecture](https://payloadcms.com/docs/plugins/overview)
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API)
- [OMDb API](https://www.omdbapi.com/)
- [Prisma @map docs](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/custom-model-and-field-names)
