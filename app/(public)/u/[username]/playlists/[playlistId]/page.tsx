/**
 * Playlist detail page.
 * Shows playlist hero, item grid, and edit controls for owners.
 * Viewers see public items only with visibility filtering.
 *
 * All data is fetched at the page level so the previous page stays
 * visible during client-side navigation — no skeleton flash.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import {
  getPublicProfile,
  getProfileByIdOrUsername,
  getPublicPlaylist,
} from "@/lib/public-auth";
import { getPlaylist } from "@/lib/playlist-actions";
import { getCachedGoogleDriveConnection } from "@/lib/google-drive-data";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumb-jsonld";
import { SiteHeader } from "@/components/site-header";
import { PlaylistDetailClient } from "@/components/playlists/playlist-detail-client";
import { PlaylistContentSkeleton } from "@/components/skeletons/playlist-content-skeleton";
import { PrivateResourceNotice } from "@/components/ui/private-resource-notice";

interface PageProps {
  params: Promise<{ username: string; playlistId: string }>;
  searchParams: Promise<{ token?: string; skeleton?: string }>;
}

/**
 * Generates metadata for the playlist detail page.
 */
export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { username, playlistId } = await params;
  const { token } = await searchParams;

  const session = await auth();
  const sessionUsername = session?.user?.username;
  const isOwnerByUsername =
    sessionUsername && sessionUsername.toLowerCase() === username.toLowerCase();

  const profile = isOwnerByUsername
    ? await getProfileByIdOrUsername(username)
    : await getPublicProfile(username);

  if (!profile) {
    return { title: "Playlist Not Found" };
  }

  const isOwner = session?.user?.id === profile.id;

  const canonicalPath = `/u/${username}/playlists/${playlistId}`;

  if (isOwner) {
    const result = await getPlaylist(playlistId);
    if (!result.success || !result.data) {
      return { title: "Playlist Not Found" };
    }
    const displayName = profile.name ?? `@${username}`;
    return {
      title: `${result.data.name} by ${displayName} | CanonCore`,
      description:
        result.data.description ?? `Playlist by @${username} on CanonCore.`,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        title: `${result.data.name} | CanonCore`,
        description:
          result.data.description ?? `Playlist by @${username} on CanonCore.`,
        type: "article",
      },
    };
  }

  const publicData = await getPublicPlaylist(playlistId, token);
  if (!publicData) {
    return { title: "Playlist Not Found" };
  }

  const displayName = profile.name ?? `@${username}`;
  const itemCount = publicData.items.length;
  return {
    title: `${publicData.playlist.name} by ${displayName} | CanonCore`,
    description: publicData.playlist.description
      ? `"${publicData.playlist.description}" — ${itemCount} items curated by @${username}`
      : `Playlist by @${username} on CanonCore.`,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: `${publicData.playlist.name} | CanonCore`,
      description: publicData.playlist.description
        ? `"${publicData.playlist.description}" — ${itemCount} items curated by @${username}`
        : `Playlist by @${username} on CanonCore.`,
      type: "article",
    },
  };
}

/**
 * Playlist detail page server component.
 * Fetches all data at the page level — no internal Suspense boundaries.
 */
export default async function PlaylistPage({
  params,
  searchParams,
}: PageProps) {
  const { username, playlistId } = await params;
  const resolvedSearchParams = await searchParams;
  const { token } = resolvedSearchParams;

  // Dev-only: ?skeleton=true freezes the skeleton for visual comparison
  if (
    process.env.NODE_ENV === "development" &&
    resolvedSearchParams.skeleton === "true"
  ) {
    return (
      <>
        <SiteHeader title="Playlists" titleHref={`/u/${username}`} />
        <div className="bg-background text-foreground flex flex-1 flex-col">
          <PlaylistContentSkeleton />
        </div>
      </>
    );
  }

  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("publicProfile"),
    auth(),
  ]);

  if (rateLimitResult) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          Too many requests. Please try again later.
        </p>
      </div>
    );
  }

  const sessionUsername = session?.user?.username;
  const isOwnerByUsername =
    sessionUsername && sessionUsername.toLowerCase() === username.toLowerCase();

  const profile = isOwnerByUsername
    ? await getProfileByIdOrUsername(username)
    : await getPublicProfile(username);

  if (!profile) {
    notFound();
  }

  const isOwner = session?.user?.id === profile.id;

  if (isOwner) {
    // ── Owner path ──────────────────────────────────────────────────────
    const [result, driveConnection] = await Promise.all([
      getPlaylist(playlistId),
      getCachedGoogleDriveConnection(),
    ]);

    if (!result.success || !result.data) notFound();

    const resolvedColour =
      result.data.dominantColour ??
      result.data.items[0]?.item.dominantColour ??
      null;

    return (
      <>
        <SiteHeader
          title="My Playlists"
          titleHref={`/u/${username}`}
          driveNeedsReauth={driveConnection?.needsReauth ?? false}
        />
        <div className="bg-background text-foreground flex flex-1 flex-col">
          <PlaylistDetailClient
            playlist={result.data}
            username={username}
            isOwner
            dominantColour={resolvedColour}
          />
        </div>
      </>
    );
  }

  // ── Viewer path ─────────────────────────────────────────────────────
  const currentUserId = session?.user?.id ?? null;
  const publicData = await getPublicPlaylist(playlistId, token);

  if (!publicData) {
    if (currentUserId) {
      const privatePlaylist = await prisma.playlist.findUnique({
        where: { id: playlistId },
        select: { userId: true },
      });
      if (privatePlaylist?.userId === currentUserId) {
        return (
          <>
            <SiteHeader
              title={`@${profile.username}`}
              titleHref={`/u/${username}`}
            />
            <PrivateResourceNotice
              resourceType="playlist"
              settingsUrl={`/u/${username}/playlists/${playlistId}`}
            />
          </>
        );
      }
    }
    notFound();
  }

  const resolvedColour =
    publicData.playlist.dominantColour ??
    publicData.items[0]?.dominantColour ??
    null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: appUrl },
    {
      name: profile.name ?? `@${profile.username}`,
      url: `${appUrl}/u/${username}`,
    },
    { name: "Playlists", url: `${appUrl}/u/${username}` },
    {
      name: publicData.playlist.name,
      url: `${appUrl}/u/${username}/playlists/${playlistId}`,
    },
  ]);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: publicData.playlist.name,
    description: publicData.playlist.description ?? undefined,
    author: {
      "@type": "Person",
      name: profile.name ?? profile.username,
      url: `${appUrl}/u/${username}`,
    },
    numberOfItems: publicData.items.length,
    dateCreated: publicData.playlist.createdAt,
    dateModified: publicData.playlist.updatedAt,
    image: publicData.playlist.hasArtwork
      ? `${appUrl}/api/playlist/artwork?playlistId=${playlistId}`
      : undefined,
    itemListElement: publicData.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: `${appUrl}/u/${username}/${item.id}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <SiteHeader title={`@${profile.username}`} titleHref={`/u/${username}`} />
      <div className="bg-background text-foreground flex flex-1 flex-col">
        <PlaylistDetailClient
          playlist={{
            id: publicData.playlist.id,
            name: publicData.playlist.name,
            description: publicData.playlist.description,
            items: publicData.items.map((item, index) => ({
              playlistItemId: `public-${item.id}`,
              order: index,
              addedAt: new Date(),
              item: {
                id: item.id,
                name: item.name,
                description: item.description,
                tmdbPosterPath: item.tmdbPosterPath,
                artworkId: item.artworkId,
              },
            })),
          }}
          username={username}
          isOwner={false}
          dominantColour={resolvedColour}
        />
      </div>
    </>
  );
}
