/**
 * Public explore page showcasing featured and recent public items.
 * Features a cinematic hero carousel with 5 featured items at the top.
 *
 * All data is fetched at the page level so the previous page stays
 * visible during client-side navigation — no skeleton flash.
 */

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
 * Fetches all data at the page level — no internal Suspense boundaries.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // Dev-only: ?skeleton=true freezes the skeleton for visual comparison
  if (process.env.NODE_ENV === "development" && params.skeleton === "true") {
    return (
      <>
        <SiteHeader title="Explore" titleHref="/explore" />
        <div className="text-foreground -mt-(--header-height) flex flex-1 flex-col">
          <ExploreContentSkeleton />
        </div>
      </>
    );
  }

  const [session, driveConnection] = await Promise.all([
    auth(),
    getCachedGoogleDriveConnection(),
  ]);
  const currentUserId = session?.user?.id ?? null;
  const emailUnverified = session?.user ? !session.user.emailVerified : false;
  const driveNeedsReauth = driveConnection?.needsReauth ?? false;

  // Rate limit check
  const rateLimitResult = await checkRateLimit("explore");
  if (rateLimitResult) {
    return (
      <>
        <SiteHeader
          title="Explore"
          titleHref="/explore"
          emailUnverified={emailUnverified}
          driveNeedsReauth={driveNeedsReauth}
        />
        <div className="text-foreground -mt-(--header-height) flex flex-1 flex-col">
          <Section className="py-16">
            <div className="rounded-xl border border-dashed border-[var(--glass-border)] p-8 text-center">
              <p className="text-muted-foreground text-sm">
                {rateLimitResult.error}
              </p>
            </div>
          </Section>
        </div>
      </>
    );
  }

  const { q } = await exploreSearchParamsCache.parse(searchParams);
  const search = q || undefined;

  const profilePromise = getProfile();

  // Chain TMDB enrichment on featured items
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

  // Build sync data map for the current user's own featured items only
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
    <>
      <SiteHeader
        title="Explore"
        titleHref="/explore"
        emailUnverified={emailUnverified}
        driveNeedsReauth={driveNeedsReauth}
      />
      <div className="text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <ExploreClient
          initialItems={items}
          initialPlaylists={playlists}
          initialSearch={q}
          featuredItems={enrichedFeaturedItems}
          currentUser={currentUser}
          ownItemSyncData={ownItemSyncData}
        />
      </div>
    </>
  );
}
