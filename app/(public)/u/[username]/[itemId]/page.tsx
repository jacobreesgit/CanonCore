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
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import { ItemDetailClient } from "@/components/items";
import { PublicItemClient } from "./public-item-client";

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

  const [profile, item] = await Promise.all([
    getPublicProfile(username),
    getPublicItem(itemId),
  ]);

  if (!profile || !item) {
    return { title: "Item Not Found" };
  }

  const displayName = profile.name ?? `@${profile.username}`;

  return {
    title: `${item.name} by ${displayName} | CanonCore`,
    description:
      item.description ??
      `View ${item.name} on ${displayName}'s media library.`,
    openGraph: {
      title: `${item.name} | CanonCore`,
      description:
        item.description ??
        `View ${item.name} on ${displayName}'s media library.`,
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

    // Fetch additional data in parallel
    const [childrenResult, filesResult, itemProgress, driveConnection] =
      await Promise.all([
        getDescendants(itemId),
        getItemFiles(itemId),
        getItemProgress(itemId),
        getGoogleDriveConnection(),
      ]);

    const childItems = childrenResult.success
      ? (childrenResult.data ?? [])
      : [];
    const files =
      filesResult.success && filesResult.data
        ? filesResult.data
        : { media: [], artwork: [], subtitles: [] };
    const hasDriveConnection = Boolean(driveConnection);

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
        />
        <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
          <ItemDetailClient
            item={{
              id: item.id,
              name: item.name,
              description: item.description,
              isPublic: item.isPublic,
              inheritVisibility: item.inheritVisibility,
              parentId: item.parentId,
              childCount: childItems.length,
            }}
            childItems={childItems}
            files={files}
            itemProgress={itemProgress}
            hasDriveConnection={hasDriveConnection}
            currentUser={currentUser}
            defaultSettingsOpen={defaultSettingsOpen}
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

    // Get additional data in parallel
    const [childItems, breadcrumb, forkInfo, forkStatusResult, currentUser] =
      await Promise.all([
        getPublicDescendants(itemId),
        getPublicBreadcrumb(itemId),
        getForkInfo(itemId),
        getForkStatus(itemId), // Safe for unauthenticated - returns error
        currentUserId
          ? prisma.user.findUnique({
              where: { id: currentUserId },
              select: { username: true },
            })
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
        />
        <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
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
          />
        </div>
      </>
    );
  }
}
