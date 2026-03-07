/**
 * Public explore page showcasing featured and recent public items.
 * Features a cinematic hero carousel with 5 featured items at the top.
 *
 * Renders a fast shell (SiteHeader) immediately, then streams the heavy
 * content (featured items + TMDB enrichment, explore grid, playlists)
 * via a Suspense boundary for improved TTFB.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { auth } from "@/lib/auth";
import {
  getExploreItems,
  getExplorePlaylists,
  getFeaturedItems,
} from "@/lib/public-auth";
import { getProfile } from "@/lib/user-actions";
import { getItemTmdbMetadata } from "@/lib/tmdb-client";
import { prisma } from "@/lib/prisma";
import { getCachedGoogleDriveConnection } from "@/lib/google-drive-data";
import { checkRateLimit } from "@/lib/rate-limit";
import { SiteHeader } from "@/components/site-header";
import { Section } from "@/components/ui/section";
import { ExploreClient } from "./explore-client";
import { ExploreContentSkeleton } from "@/components/skeletons/explore-content-skeleton";
import { exploreSearchParamsCache } from "./search-params";
import type { SyncStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Explore | CanonCore",
  description:
    "Discover public items from the CanonCore community. Browse and fork curated media libraries.",
  openGraph: {
    title: "Explore | CanonCore",
    description:
      "Discover public items from the CanonCore community. Browse and fork curated media libraries.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore | CanonCore",
    description:
      "Discover public items from the CanonCore community. Browse and fork curated media libraries.",
  },
};

/**
 * Explore page server component.
 * Renders the header shell immediately, then streams heavy content via Suspense.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Fast shell: auth for SiteHeader
  const [session, driveConnection] = await Promise.all([
    auth(),
    getCachedGoogleDriveConnection(),
  ]);
  const currentUserId = session?.user?.id ?? null;
  const emailUnverified = session?.user ? !session.user.emailVerified : false;
  const driveNeedsReauth = driveConnection?.needsReauth ?? false;

  return (
    <>
      <SiteHeader
        title="Explore"
        titleHref="/explore"
        emailUnverified={emailUnverified}
        driveNeedsReauth={driveNeedsReauth}
      />
      <div className="text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <Suspense fallback={<ExploreContentSkeleton />}>
          <ExploreContent
            currentUserId={currentUserId}
            searchParams={searchParams}
          />
        </Suspense>
      </div>
    </>
  );
}

/**
 * Streamed explore content — all heavy data fetching lives here so the
 * page shell can render before these queries resolve.
 */
async function ExploreContent({
  currentUserId,
  searchParams,
}: {
  currentUserId: string | null;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rateLimitResult = await checkRateLimit("explore");
  if (rateLimitResult) {
    return (
      <Section className="py-16">
        <div className="rounded-xl border border-dashed border-[var(--glass-border)] p-8 text-center">
          <p className="text-muted-foreground text-sm">
            {rateLimitResult.error}
          </p>
        </div>
      </Section>
    );
  }

  const { q } = await exploreSearchParamsCache.parse(searchParams);
  const search = q || undefined;

  const profilePromise = getProfile();

  // Chain TMDB enrichment on featured items so metadata fetching starts
  // as soon as featured items resolve, without waiting for the full items list.
  const enrichedFeaturedPromise = getFeaturedItems(5).then(
    async (featuredItems) => {
      const tmdbResults = await Promise.all(
        featuredItems.map((item) =>
          item.tmdbId && item.tmdbType
            ? getItemTmdbMetadata(item.tmdbId, item.tmdbType)
            : Promise.resolve(null)
        )
      );
      return featuredItems.map((item, i) => ({
        ...item,
        tmdbMetadata: tmdbResults[i] ?? null,
      }));
    }
  );

  const [profileResult, enrichedFeaturedItems, items, playlists] =
    await Promise.all([
      profilePromise,
      enrichedFeaturedPromise,
      getExploreItems({ search, currentUserId }),
      getExplorePlaylists({ search }),
    ]);

  const profile = profileResult.success ? profileResult.data : null;
  const currentUser = profile
    ? { id: profile.id, username: profile.username, name: profile.name }
    : null;

  // Build sync data map for the current user's own featured items only.
  // This keeps driveFileId out of the public response for other users' items.
  let ownItemSyncData:
    | Record<string, { syncStatus: SyncStatus; driveFileId: string | null }>
    | undefined;

  if (currentUserId) {
    const ownFeaturedIds = enrichedFeaturedItems
      .filter((item) => item.ownerUserId === currentUserId)
      .map((item) => item.id);

    if (ownFeaturedIds.length > 0) {
      const syncRows = await prisma.item.findMany({
        where: { id: { in: ownFeaturedIds }, userId: currentUserId },
        select: { id: true, syncStatus: true, driveFileId: true },
      });
      ownItemSyncData = Object.fromEntries(
        syncRows.map((row) => [
          row.id,
          {
            syncStatus: row.syncStatus as SyncStatus,
            driveFileId: row.driveFileId,
          },
        ])
      );
    }
  }

  return (
    <ExploreClient
      initialItems={items}
      initialPlaylists={playlists}
      initialSearch={q}
      featuredItems={enrichedFeaturedItems}
      currentUser={currentUser}
      ownItemSyncData={ownItemSyncData}
    />
  );
}
