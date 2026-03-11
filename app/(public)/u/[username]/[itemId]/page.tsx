/**
 * Unified item detail page displaying a single item.
 * Shows full editing for owners, read-only view with fork for visitors.
 *
 * All data is fetched at the page level (parallel Promise.all) so that
 * the previous page stays visible during client-side navigation — no
 * skeleton flash. loading.tsx was removed to prevent the known Next.js
 * double-skeleton issue (vercel/next.js#43209).
 */

import { notFound } from "next/navigation";
import { Metadata } from "next";
import {
  getPublicProfile,
  getProfileByIdOrUsername,
  getPublicItem,
  getPublicDescendants,
  getPublicBreadcrumb,
} from "@/lib/public-auth";
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

interface PageProps {
  params: Promise<{ username: string; itemId: string }>;
  searchParams: Promise<{ settings?: string; skeleton?: string }>;
}

/**
 * Generates metadata for the item page.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username, itemId } = await params;

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
    alternates: {
      canonical: `/u/${username}/${itemId}`,
    },
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
 * Fetches all data at the page level — no internal Suspense boundaries.
 */
export default async function ItemDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { username, itemId } = await params;
  const resolvedSearchParams = await searchParams;
  const { settings } = resolvedSearchParams;
  const defaultSettingsOpen = settings === "true";

  // Dev-only: ?skeleton=true freezes the skeleton for visual comparison
  if (
    process.env.NODE_ENV === "development" &&
    resolvedSearchParams.skeleton === "true"
  ) {
    return (
      <>
        <SiteHeader title="My Items" titleHref={`/u/${username}`} />
        <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
          <ItemContentSkeleton />
        </div>
      </>
    );
  }

  const session = await auth();
  const sessionUsername = session?.user?.username;

  const isOwnerByUsername =
    sessionUsername && sessionUsername.toLowerCase() === username.toLowerCase();

  const profile = isOwnerByUsername
    ? await getProfileByIdOrUsername(username)
    : await getPublicProfile(username);

  if (!profile) {
    notFound();
  }

  const currentUserId = session?.user?.id ?? null;
  const isOwner = currentUserId === profile.id;

  if (isOwner) {
    // ── Owner path ──────────────────────────────────────────────────────
    const [itemResult, driveConnection] = await Promise.all([
      getItem(itemId),
      getCachedGoogleDriveConnection(),
    ]);

    if (!itemResult.success || !itemResult.data) {
      notFound();
    }

    const { item, ancestors } = itemResult.data;

    if (item.userId !== profile.id) {
      notFound();
    }

    const tmdbDisplayOptions = extractTmdbDisplayOptions(item);

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

    const [childrenResult, filesResult, itemProgress, tmdb, watchStatusResult] =
      await Promise.all([
        getDescendants(item.id),
        getItemFiles(item.id),
        getItemProgress(item.id),
        tmdbPromise,
        getWatchStatus(item.id),
      ]);

    const childItems = childrenResult.success
      ? (childrenResult.data ?? [])
      : [];
    const files =
      filesResult.success && filesResult.data
        ? filesResult.data
        : { media: [], artwork: [], subtitles: [] };
    const hasDriveConnection = Boolean(driveConnection);
    const initialWatchStatus = watchStatusResult.success
      ? watchStatusResult.data
      : { isWatched: false, playCount: 0 };

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
            currentUser={{
              id: profile.id,
              username: profile.username,
              name: profile.name,
            }}
            defaultSettingsOpen={defaultSettingsOpen}
            tmdbMetadata={tmdb.metadata}
            tmdbDetails={tmdb.details}
            tmdbDisplayOptions={tmdbDisplayOptions}
            initialWatchStatus={initialWatchStatus}
          />
        </div>
      </>
    );
  } else {
    // ── Viewer path ─────────────────────────────────────────────────────
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

    if (item.userId !== profile.id) {
      notFound();
    }

    const viewerDisplayOptions = extractTmdbDisplayOptions(item);

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

    const [childItems, forkInfo, forkStatusResult, currentUser, tmdb] =
      await Promise.all([
        getPublicDescendants(item.id),
        getForkInfo(item.id),
        getForkStatus(item.id),
        currentUserId
          ? prisma.user.findUnique({
              where: { id: currentUserId },
              select: { username: true },
            })
          : null,
        tmdbPromise,
      ]);

    const forkStatus =
      currentUserId && "data" in forkStatusResult && forkStatusResult.data
        ? forkStatusResult.data
        : null;

    const headerBreadcrumbs = (breadcrumb ?? []).map((crumb) => ({
      id: crumb.id,
      name: crumb.name,
      href: `/u/${profile.username}/${crumb.id}`,
    }));

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
        {tmdb.metadata && (
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
                ...(tmdb.metadata.genres && {
                  genre: tmdb.metadata.genres,
                }),
                ...(tmdb.metadata.voteAverage &&
                  tmdb.metadata.voteCount && {
                    aggregateRating: {
                      "@type": "AggregateRating",
                      ratingValue: tmdb.metadata.voteAverage,
                      bestRating: 10,
                      ratingCount: tmdb.metadata.voteCount,
                    },
                  }),
              }).replace(/</g, "\\u003c"),
            }}
          />
        )}
        <SiteHeader
          title={`@${profile.username}`}
          titleHref={`/u/${profile.username}`}
          breadcrumbs={headerBreadcrumbs}
          emailUnverified={session?.user ? !session.user.emailVerified : false}
        />
        <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
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
            currentUserUsername={currentUser?.username ?? null}
            currentUserId={currentUserId}
            tmdbMetadata={tmdb.metadata}
            tmdbDetails={tmdb.details}
            tmdbDisplayOptions={viewerDisplayOptions}
          />
        </div>
      </>
    );
  }
}
