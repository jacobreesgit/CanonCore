/**
 * Unified item detail page displaying a single item.
 * Shows full editing for owners, read-only view with fork for visitors.
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
import { getGoogleDriveConnection } from "@/lib/google-drive-actions";
import { getItemTmdbMetadata, getItemTmdbDetails } from "@/lib/tmdb-client";
import {
  resolveTmdbForItem,
  extractTmdbDisplayOptions,
} from "@/lib/tmdb-utils";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import { ItemDetailClient } from "@/components/items";
import { PublicItemClient } from "./public-item-detail-client";

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
 * Renders full editor for owners, read-only view for visitors.
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
    // Owner mode: Full item detail with editing
    const itemResult = await getItem(itemId);

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

    // Extract TMDB display preferences from item
    const tmdbDisplayOptions = extractTmdbDisplayOptions(item);

    // Start TMDB resolution and non-TMDB fetches concurrently
    const resolvedTmdbPromise = resolveTmdbForItem(item);
    const childrenPromise = getDescendants(itemId);
    const filesPromise = getItemFiles(itemId);
    const progressPromise = getItemProgress(itemId);
    const drivePromise = getGoogleDriveConnection();

    // Await TMDB resolution, then fetch TMDB metadata in parallel with remaining work
    const resolvedTmdb = await resolvedTmdbPromise;
    const [
      childrenResult,
      filesResult,
      itemProgress,
      driveConnection,
      tmdbMetadata,
      tmdbDetails,
    ] = await Promise.all([
      childrenPromise,
      filesPromise,
      progressPromise,
      drivePromise,
      resolvedTmdb
        ? getItemTmdbMetadata(resolvedTmdb.tmdbId, resolvedTmdb.tmdbType)
        : null,
      resolvedTmdb
        ? getItemTmdbDetails(resolvedTmdb.tmdbId, resolvedTmdb.tmdbType)
        : null,
    ]);

    const childItems = childrenResult.success
      ? (childrenResult.data ?? [])
      : [];
    const files =
      filesResult.success && filesResult.data
        ? filesResult.data
        : { media: [], artwork: [], subtitles: [] };
    const hasDriveConnection = Boolean(driveConnection);
    const driveNeedsReauth = driveConnection?.needsReauth ?? false;

    const currentUser = {
      id: profile.id,
      username: profile.username,
      name: profile.name,
    };

    return (
      <>
        <SiteHeader
          title="My Items"
          titleHref={`/u/${profile.username}`}
          breadcrumbs={breadcrumbs}
          driveNeedsReauth={driveNeedsReauth}
        />
        <div className="bg-background text-foreground flex flex-1 flex-col">
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
              tmdbShowTagline: item.tmdbShowTagline,
              tmdbShowMetadata: item.tmdbShowMetadata,
              tmdbShowGenres: item.tmdbShowGenres,
              tmdbShowCast: item.tmdbShowCast,
              tmdbShowProviders: item.tmdbShowProviders,
              tmdbShowVideos: item.tmdbShowVideos,
              tmdbShowRecommendations: item.tmdbShowRecommendations,
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
          />
        </div>
      </>
    );
  } else {
    // Viewer mode: Read-only view with fork option
    const item = await getPublicItem(itemId);

    if (!item) {
      notFound();
    }

    // Verify item belongs to this user
    if (item.userId !== profile.id) {
      notFound();
    }

    // Extract TMDB display preferences from public item
    const viewerDisplayOptions = extractTmdbDisplayOptions(item);

    // Start TMDB resolution and non-TMDB fetches concurrently
    const resolvedTmdbPromise = resolveTmdbForItem(item);
    const descendantsPromise = getPublicDescendants(itemId);
    const breadcrumbPromise = getPublicBreadcrumb(itemId);
    const forkInfoPromise = getForkInfo(itemId);
    const forkStatusPromise = getForkStatus(itemId); // Safe for unauthenticated - returns error
    const currentUserPromise = currentUserId
      ? prisma.user.findUnique({
          where: { id: currentUserId },
          select: { username: true },
        })
      : null;
    const viewerDrivePromise = currentUserId
      ? getGoogleDriveConnection()
      : Promise.resolve(null);

    // Await TMDB resolution, then fetch TMDB metadata in parallel with remaining work
    const resolvedTmdb = await resolvedTmdbPromise;
    const [
      childItems,
      breadcrumb,
      forkInfo,
      forkStatusResult,
      currentUser,
      viewerDriveConnection,
      tmdbMetadata,
      tmdbDetails,
    ] = await Promise.all([
      descendantsPromise,
      breadcrumbPromise,
      forkInfoPromise,
      forkStatusPromise,
      currentUserPromise,
      viewerDrivePromise,
      resolvedTmdb
        ? getItemTmdbMetadata(resolvedTmdb.tmdbId, resolvedTmdb.tmdbType)
        : null,
      resolvedTmdb
        ? getItemTmdbDetails(resolvedTmdb.tmdbId, resolvedTmdb.tmdbType)
        : null,
    ]);

    // Extract fork status if authenticated and request succeeded
    const forkStatus =
      currentUserId && "data" in forkStatusResult && forkStatusResult.data
        ? forkStatusResult.data
        : null;

    const currentUserUsername = currentUser?.username ?? null;

    // Build breadcrumbs with hrefs for SiteHeader
    const headerBreadcrumbs = (breadcrumb ?? []).map((crumb) => ({
      id: crumb.id,
      name: crumb.name,
      href: `/u/${profile.username}/${crumb.id}`,
    }));

    return (
      <>
        <SiteHeader
          title={`@${profile.username}`}
          titleHref={`/u/${profile.username}`}
          breadcrumbs={headerBreadcrumbs}
          driveNeedsReauth={viewerDriveConnection?.needsReauth ?? false}
        />
        <div className="bg-background text-foreground flex flex-1 flex-col">
          <PublicItemClient
            profile={profile}
            item={item}
            childItems={childItems}
            forkInfo={"data" in forkInfo ? (forkInfo.data ?? null) : null}
            forkStatus={forkStatus}
            isAuthenticated={!!currentUserId}
            isOwnItem={false}
            currentUserUsername={currentUserUsername}
            currentUserId={currentUserId}
            tmdbMetadata={tmdbMetadata}
            tmdbDetails={tmdbDetails}
            tmdbDisplayOptions={viewerDisplayOptions}
          />
        </div>
      </>
    );
  }
}
