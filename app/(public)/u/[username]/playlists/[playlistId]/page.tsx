/**
 * Playlist detail page.
 * Shows playlist hero, item grid, and edit controls for owners.
 * Viewers see public items only with visibility filtering.
 *
 * Uses Suspense to stream playlist content — SiteHeader renders
 * immediately while the playlist data loads in the background.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import {
  getPublicProfile,
  getProfileByIdOrUsername,
  getPublicPlaylist,
} from "@/lib/public-auth";
import type { PublicProfile } from "@/lib/public-auth";
import { getPlaylist } from "@/lib/playlist-actions";
import { getCachedGoogleDriveConnection } from "@/lib/google-drive-data";
import { checkRateLimit } from "@/lib/rate-limit";
import { SiteHeader } from "@/components/site-header";
import { PlaylistDetailClient } from "@/components/playlists/playlist-detail-client";
import { PlaylistContentSkeleton } from "@/components/skeletons/playlist-content-skeleton";

interface PageProps {
  params: Promise<{ username: string; playlistId: string }>;
  searchParams: Promise<{ token?: string }>;
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
    openGraph: {
      title: `${publicData.playlist.name} | CanonCore`,
      description: publicData.playlist.description
        ? `"${publicData.playlist.description}" — ${itemCount} items curated by @${username}`
        : `Playlist by @${username} on CanonCore.`,
      type: "article",
    },
  };
}

// ---------------------------------------------------------------------------
// Async server components streamed inside Suspense
// ---------------------------------------------------------------------------

async function OwnerPlaylistContent({
  playlistId,
  username,
}: {
  playlistId: string;
  username: string;
}) {
  const result = await getPlaylist(playlistId);
  if (!result.success || !result.data) notFound();

  // Resolve colour server-side: playlist artwork > first item > null
  const resolvedColour =
    result.data.dominantColour ??
    result.data.items[0]?.item.dominantColour ??
    null;

  return (
    <PlaylistDetailClient
      playlist={result.data}
      username={username}
      isOwner
      dominantColour={resolvedColour}
    />
  );
}

async function ViewerPlaylistContent({
  playlistId,
  username,
  profile,
  token,
}: {
  playlistId: string;
  username: string;
  profile: PublicProfile;
  token?: string;
}) {
  const publicData = await getPublicPlaylist(playlistId, token);
  if (!publicData) notFound();

  // Resolve colour server-side: playlist artwork > first item > null
  const resolvedColour =
    publicData.playlist.dominantColour ??
    publicData.items[0]?.dominantColour ??
    null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Page component — fast shell with Suspense streaming
// ---------------------------------------------------------------------------

/**
 * Playlist detail page server component.
 * Renders the SiteHeader immediately, then streams playlist content
 * via Suspense while the data loads.
 */
export default async function PlaylistPage({
  params,
  searchParams,
}: PageProps) {
  const { username, playlistId } = await params;
  const { token } = await searchParams;

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
    const driveConnection = await getCachedGoogleDriveConnection();

    return (
      <>
        <SiteHeader
          title="My Playlists"
          titleHref={`/u/${username}`}
          driveNeedsReauth={driveConnection?.needsReauth ?? false}
        />
        <div className="bg-background text-foreground flex flex-1 flex-col">
          <Suspense fallback={<PlaylistContentSkeleton />}>
            <OwnerPlaylistContent playlistId={playlistId} username={username} />
          </Suspense>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader title={`@${profile.username}`} titleHref={`/u/${username}`} />
      <div className="bg-background text-foreground flex flex-1 flex-col">
        <Suspense fallback={<PlaylistContentSkeleton />}>
          <ViewerPlaylistContent
            playlistId={playlistId}
            username={username}
            profile={profile}
            token={token}
          />
        </Suspense>
      </div>
    </>
  );
}
