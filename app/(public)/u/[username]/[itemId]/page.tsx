/**
 * Unified item detail page displaying a single item.
 * Shows full editing for owners, read-only view with fork for visitors.
 *
 * Uses Suspense boundaries to stream heavy content (TMDB chain, descendants,
 * files, progress) while showing breadcrumbs and header instantly.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import {
  getPublicProfile,
  getProfileByIdOrUsername,
  getPublicItem,
  getPublicDescendants,
  getPublicBreadcrumb,
} from "@/lib/public-auth";
import type { PublicItem, PublicProfile } from "@/lib/public-auth";
import { getItem, getDescendants, getItemProgress } from "@/lib/item-actions";
import { getItemFiles } from "@/lib/item-file-actions";
import { getForkStatus, getForkInfo } from "@/lib/fork-actions";
import { getCachedGoogleDriveConnection } from "@/lib/google-drive-data";
import { getWatchStatus } from "@/lib/watch-actions";
import { getItemTmdbMetadata, getItemTmdbDetails } from "@/lib/tmdb-client";
import {
  resolveTmdbForItem,
  extractTmdbDisplayOptions,
} from "@/lib/tmdb-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumb-jsonld";
import { SiteHeader } from "@/components/site-header";
import { ItemDetailClient } from "@/components/items";
import { PublicItemClient } from "./public-item-detail-client";
import { ItemContentSkeleton } from "@/components/skeletons/item-content-skeleton";
import { PrivateResourceNotice } from "@/components/ui/private-resource-notice";
import type { Item } from "@/lib/types";

interface PageProps {
  params: Promise<{ username: string; itemId: string }>;
  searchParams: Promise<{ settings?: string }>;
}

/**
 * Generates metadata for the item page.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username, itemId } = await params;

  // Check auth to determine ownership (mirrors page component logic)
  const session = await auth();
  const sessionUsername = session?.user?.username;
  const isOwnerByUsername =
    sessionUsername && sessionUsername.toLowerCase() === username.toLowerCase();

  const profile = isOwnerByUsername
    ? await getProfileByIdOrUsername(username)
    : await getPublicProfile(username);

  if (!profile) {
    return { title: "Item Not Found" };
  }

  // Owner can see private items; viewers only see public items
  let itemName: string | undefined;
  let itemDescription: string | null = null;

  if (isOwnerByUsername) {
    const result = await getItem(itemId);
    if (result.success && result.data) {
      itemName = result.data.item.name;
      itemDescription = result.data.item.description;
    }
  } else {
    const publicItem = await getPublicItem(itemId);
    if (publicItem) {
      itemName = publicItem.name;
      itemDescription = publicItem.description;
    }
  }

  if (!itemName) {
    return { title: "Item Not Found" };
  }

  const displayName = profile.name ?? `@${profile.username}`;

  return {
    title: `${itemName} by ${displayName} | CanonCore`,
    description:
      itemDescription ?? `View ${itemName} on ${displayName}'s media library.`,
    openGraph: {
      title: `${itemName} | CanonCore`,
      description:
        itemDescription ??
        `View ${itemName} on ${displayName}'s media library.`,
      type: "article",
    },
  };
}

/**
 * Unified item detail page server component.
 * Renders fast shell (header + breadcrumbs) immediately, streams heavy content
 * (TMDB chain, descendants, files, progress) via Suspense boundaries.
 */
export default async function ItemDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { username, itemId } = await params;
  const { settings } = await searchParams;
  const defaultSettingsOpen = settings === "true";

  // Get auth first to determine ownership
  const session = await auth();
  const sessionUsername = session?.user?.username;

  // Check if owner by username match (case-insensitive)
  const isOwnerByUsername =
    sessionUsername && sessionUsername.toLowerCase() === username.toLowerCase();

  // Use appropriate profile fetch based on ownership
  // Owner can view even if profile isn't public
  const profile = isOwnerByUsername
    ? await getProfileByIdOrUsername(username)
    : await getPublicProfile(username);

  if (!profile) {
    notFound();
  }

  const currentUserId = session?.user?.id ?? null;
  const isOwner = currentUserId === profile.id;

  if (isOwner) {
    // Owner: keep getItem for breadcrumbs + 404
    const [itemResult, driveConnection] = await Promise.all([
      getItem(itemId),
      getCachedGoogleDriveConnection(),
    ]);

    if (!itemResult.success || !itemResult.data) {
      notFound();
    }

    const { item, ancestors } = itemResult.data;

    // Verify item belongs to this user
    if (item.userId !== profile.id) {
      notFound();
    }

    // Build breadcrumbs with hrefs for SiteHeader
    const breadcrumbs = [...ancestors, { id: item.id, name: item.name }].map(
      (a) => ({
        id: a.id,
        name: a.name,
        href: `/u/${profile.username}/${a.id}`,
      })
    );

    return (
      <>
        <SiteHeader
          title="My Items"
          titleHref={`/u/${profile.username}`}
          breadcrumbs={breadcrumbs}
          emailUnverified={session?.user ? !session.user.emailVerified : false}
          driveNeedsReauth={driveConnection?.needsReauth ?? false}
        />
        <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
          <Suspense fallback={<ItemContentSkeleton />}>
            <OwnerItemContent
              item={item}
              profile={profile}
              defaultSettingsOpen={defaultSettingsOpen}
            />
          </Suspense>
        </div>
      </>
    );
  } else {
    // Viewer: keep rate limit, getPublicItem for 404, breadcrumb for header
    const rateLimitResult = await checkRateLimit("publicProfile");
    if (rateLimitResult) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="text-muted-foreground">
            Too many requests. Please try again later.
          </p>
        </div>
      );
    }

    const [item, breadcrumb] = await Promise.all([
      getPublicItem(itemId),
      getPublicBreadcrumb(itemId),
    ]);

    if (!item) {
      // Lightweight ownership check: show hint if owner is viewing their own private item
      if (currentUserId) {
        const privateItem = await prisma.item.findUnique({
          where: { id: itemId },
          select: { userId: true },
        });
        if (privateItem?.userId === currentUserId) {
          return (
            <>
              <SiteHeader
                title={`@${profile.username}`}
                titleHref={`/u/${profile.username}`}
                emailUnverified={
                  session?.user ? !session.user.emailVerified : false
                }
              />
              <PrivateResourceNotice
                resourceType="item"
                settingsUrl={`/u/${username}/${itemId}?settings=true`}
              />
            </>
          );
        }
      }
      notFound();
    }

    // Verify item belongs to this user
    if (item.userId !== profile.id) {
      notFound();
    }

    // Build breadcrumbs with hrefs for SiteHeader
    const headerBreadcrumbs = (breadcrumb ?? []).map((crumb) => ({
      id: crumb.id,
      name: crumb.name,
      href: `/u/${profile.username}/${crumb.id}`,
    }));

    // BreadcrumbList JSON-LD: Home > Username > [ancestors...] > Item
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://canoncore.com";
    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
      { name: "Home", url: appUrl },
      {
        name: profile.name ?? `@${profile.username}`,
        url: `${appUrl}/u/${profile.username}`,
      },
      ...(breadcrumb ?? []).map((crumb) => ({
        name: crumb.name,
        url: `${appUrl}/u/${profile.username}/${crumb.id}`,
      })),
      { name: item.name, url: `${appUrl}/u/${profile.username}/${item.id}` },
    ]);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <SiteHeader
          title={`@${profile.username}`}
          titleHref={`/u/${profile.username}`}
          breadcrumbs={headerBreadcrumbs}
          emailUnverified={session?.user ? !session.user.emailVerified : false}
        />
        <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
          <Suspense fallback={<ItemContentSkeleton />}>
            <ViewerItemContent
              item={item}
              profile={profile}
              currentUserId={currentUserId}
            />
          </Suspense>
        </div>
      </>
    );
  }
}

// ---------------------------------------------------------------------------
// Owner: async server component for heavy data fetching
// ---------------------------------------------------------------------------

interface OwnerItemContentProps {
  item: Item;
  profile: PublicProfile;
  defaultSettingsOpen: boolean;
}

async function OwnerItemContent({
  item,
  profile,
  defaultSettingsOpen,
}: OwnerItemContentProps) {
  // Extract TMDB display preferences from item
  const tmdbDisplayOptions = extractTmdbDisplayOptions(item);

  // Chain TMDB resolution → metadata/details fetch as single promise
  const tmdbPromise = resolveTmdbForItem(
    item.id,
    item.tmdbId,
    item.tmdbType
  ).then(async (resolved) => {
    if (!resolved) return { metadata: null, details: null };
    const [metadata, details] = await Promise.all([
      getItemTmdbMetadata(resolved.tmdbId, resolved.tmdbType),
      getItemTmdbDetails(resolved.tmdbId, resolved.tmdbType),
    ]);
    return { metadata, details };
  });

  // All fetches run concurrently — TMDB chain doesn't block other work
  const [
    childrenResult,
    filesResult,
    itemProgress,
    driveConnection,
    tmdb,
    watchStatusResult,
  ] = await Promise.all([
    getDescendants(item.id),
    getItemFiles(item.id),
    getItemProgress(item.id),
    getCachedGoogleDriveConnection(),
    tmdbPromise,
    getWatchStatus(item.id),
  ]);

  const tmdbMetadata = tmdb.metadata;
  const tmdbDetails = tmdb.details;

  const childItems = childrenResult.success ? (childrenResult.data ?? []) : [];
  const files =
    filesResult.success && filesResult.data
      ? filesResult.data
      : { media: [], artwork: [], subtitles: [] };
  const hasDriveConnection = Boolean(driveConnection);
  const initialWatchStatus = watchStatusResult.success
    ? watchStatusResult.data
    : { isWatched: false, playCount: 0 };

  const currentUser = {
    id: profile.id,
    username: profile.username,
    name: profile.name,
  };

  return (
    <ItemDetailClient
      item={{
        id: item.id,
        name: item.name,
        description: item.description,
        isPublic: item.isPublic,
        inheritVisibility: item.inheritVisibility,
        parentId: item.parentId,
        childCount: childItems.length,
        tmdbId: item.tmdbId,
        tmdbType: item.tmdbType,
        tmdbPosterPath: item.tmdbPosterPath,
        tmdbBackdropPath: item.tmdbBackdropPath,
        tmdbLogoPath: item.tmdbLogoPath,
        tmdbShowTagline: item.tmdbShowTagline,
        tmdbShowMetadata: item.tmdbShowMetadata,
        tmdbShowGenres: item.tmdbShowGenres,
        tmdbShowCast: item.tmdbShowCast,
        tmdbShowProviders: item.tmdbShowProviders,
        tmdbShowVideos: item.tmdbShowVideos,
        tmdbShowRecommendations: item.tmdbShowRecommendations,
        dominantColour: item.dominantColour,
        syncStatus: item.syncStatus,
        driveFileId: item.driveFileId,
      }}
      childItems={childItems}
      files={files}
      itemProgress={itemProgress}
      hasDriveConnection={hasDriveConnection}
      currentUser={currentUser}
      defaultSettingsOpen={defaultSettingsOpen}
      tmdbMetadata={tmdbMetadata}
      tmdbDetails={tmdbDetails}
      tmdbDisplayOptions={tmdbDisplayOptions}
      initialWatchStatus={initialWatchStatus}
    />
  );
}

// ---------------------------------------------------------------------------
// Viewer: async server component for heavy data fetching
// ---------------------------------------------------------------------------

interface ViewerItemContentProps {
  item: PublicItem;
  profile: PublicProfile;
  currentUserId: string | null;
}

async function ViewerItemContent({
  item,
  profile,
  currentUserId,
}: ViewerItemContentProps) {
  // Extract TMDB display preferences from public item
  const viewerDisplayOptions = extractTmdbDisplayOptions(item);

  // Chain TMDB resolution → metadata/details fetch as single promise
  const tmdbPromise = resolveTmdbForItem(
    item.id,
    item.tmdbId,
    item.tmdbType
  ).then(async (resolved) => {
    if (!resolved) return { metadata: null, details: null };
    const [metadata, details] = await Promise.all([
      getItemTmdbMetadata(resolved.tmdbId, resolved.tmdbType),
      getItemTmdbDetails(resolved.tmdbId, resolved.tmdbType),
    ]);
    return { metadata, details };
  });

  // All fetches run concurrently — TMDB chain doesn't block other work
  const [childItems, forkInfo, forkStatusResult, currentUser, tmdb] =
    await Promise.all([
      getPublicDescendants(item.id),
      getForkInfo(item.id),
      getForkStatus(item.id), // Safe for unauthenticated - returns error
      currentUserId
        ? prisma.user.findUnique({
            where: { id: currentUserId },
            select: { username: true },
          })
        : null,
      tmdbPromise,
    ]);

  const tmdbMetadata = tmdb.metadata;
  const tmdbDetails = tmdb.details;

  // Extract fork status if authenticated and request succeeded
  const forkStatus =
    currentUserId && "data" in forkStatusResult && forkStatusResult.data
      ? forkStatusResult.data
      : null;

  const currentUserUsername = currentUser?.username ?? null;

  return (
    <>
      {tmdbMetadata && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": item.tmdbType === "tv" ? "TVSeries" : "Movie",
              name: item.name,
              description: item.description,
              ...(item.tmdbPosterPath && {
                image: `https://image.tmdb.org/t/p/w500${item.tmdbPosterPath}`,
              }),
              ...(tmdbMetadata.genres && {
                genre: tmdbMetadata.genres,
              }),
              ...(tmdbMetadata.voteAverage &&
                tmdbMetadata.voteCount && {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: tmdbMetadata.voteAverage,
                    bestRating: 10,
                    ratingCount: tmdbMetadata.voteCount,
                  },
                }),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <PublicItemClient
        profile={{
          id: profile.id,
          name: profile.name,
          username: profile.username,
        }}
        item={item}
        childItems={childItems}
        forkInfo={"data" in forkInfo ? (forkInfo.data ?? null) : null}
        forkStatus={forkStatus}
        isAuthenticated={!!currentUserId}
        isOwnItem={currentUserId === profile.id}
        currentUserUsername={currentUserUsername}
        currentUserId={currentUserId}
        tmdbMetadata={tmdbMetadata}
        tmdbDetails={tmdbDetails}
        tmdbDisplayOptions={viewerDisplayOptions}
      />
    </>
  );
}
