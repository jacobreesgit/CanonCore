/**
 * Playlist detail page.
 * Shows playlist hero, item grid, and edit controls for owners.
 * Viewers see public items only with visibility filtering.
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
import { checkRateLimit } from "@/lib/rate-limit";
import { SiteHeader } from "@/components/site-header";
import { PlaylistDetailClient } from "@/components/playlists/playlist-detail-client";

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
        type: "website",
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

/**
 * Playlist detail page server component.
 * Fetches playlist data based on owner/viewer mode.
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
    const result = await getPlaylist(playlistId);
    if (!result.success || !result.data) {
      notFound();
    }

    return (
      <>
        <SiteHeader
          title="My Playlists"
          titleHref={`/u/${username}`}
          breadcrumbs={[
            {
              id: result.data.id,
              name: result.data.name,
              href: `/u/${username}/playlists/${result.data.id}`,
            },
          ]}
        />
        <div className="bg-background text-foreground flex flex-1 flex-col">
          <PlaylistDetailClient
            playlist={result.data}
            username={username}
            isOwner
          />
        </div>
      </>
    );
  }

  // Viewer mode
  const publicData = await getPublicPlaylist(playlistId, token);
  if (!publicData) {
    notFound();
  }

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
      <SiteHeader
        title={`@${profile.username}`}
        titleHref={`/u/${username}`}
        breadcrumbs={[
          {
            id: publicData.playlist.id,
            name: publicData.playlist.name,
            href: `/u/${username}/playlists/${publicData.playlist.id}`,
          },
        ]}
      />
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
                artworkId: item.artworkId,
              },
            })),
          }}
          username={username}
          isOwner={false}
        />
      </div>
    </>
  );
}
