/**
 * Playlist card with 2x2 artwork collage, name, and item count.
 * Used in playlist grids on profile pages (owner and viewer modes).
 * Supports custom artwork, visibility badge, and hover overlay.
 */

"use client";

import { forwardRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ListMusic, Eye, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTmdbPosterUrl } from "@/lib/tmdb-image-utils";

interface PlaylistCardProps {
  /** Playlist data. */
  playlist: {
    id: string;
    name: string;
    description?: string | null;
    itemCount: number;
    previewPosters: {
      tmdbPosterPath: string | null;
      artworkId: string | null;
    }[];
    isPublic?: boolean;
    hasArtwork?: boolean;
  };
  /** Profile username for URL construction. */
  username: string;
  /** Whether to prioritise image loading (above-the-fold). */
  priority?: boolean;
  /** Whether this card is shown in owner mode (shows visibility badge). */
  isOwner?: boolean;
}

/**
 * Displays a playlist as a card with artwork, visibility badge, and hover overlay.
 * Links to the playlist detail page.
 */
export const PlaylistCard = forwardRef<HTMLAnchorElement, PlaylistCardProps>(
  function PlaylistCard(
    { playlist, username, priority = false, isOwner = false },
    ref
  ) {
    const artworks = playlist.previewPosters
      .map((p) =>
        p.tmdbPosterPath
          ? getTmdbPosterUrl(p.tmdbPosterPath, "w342")
          : p.artworkId
            ? `/api/artwork/${p.artworkId}`
            : null
      )
      .filter(Boolean) as string[];
    const href = `/u/${username}/playlists/${playlist.id}`;

    return (
      <Link
        ref={ref}
        href={href}
        className="content-auto-card group block space-y-2"
        data-testid={`playlist-card-${playlist.id}`}
      >
        {/* Artwork collage */}
        <div
          className={cn(
            "relative aspect-square overflow-hidden rounded-md",
            "bg-muted ring-border/20 ring-1",
            "transition-transform duration-200 group-hover:scale-[1.02]"
          )}
        >
          {/* Visibility badge (owner only) */}
          {isOwner && playlist.isPublic !== undefined && (
            <div className="absolute top-1.5 right-1.5 z-10">
              {playlist.isPublic ? (
                <Eye className="size-3.5 text-white/60 drop-shadow" />
              ) : (
                <Lock className="size-3.5 text-white/60 drop-shadow" />
              )}
            </div>
          )}

          {/* Custom artwork */}
          {playlist.hasArtwork ? (
            <Image
              src={`/api/playlist/artwork?playlistId=${playlist.id}`}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
              priority={priority}
            />
          ) : artworks.length === 0 ? (
            <div className="flex size-full items-center justify-center">
              <ListMusic className="text-muted-foreground/40 size-10" />
            </div>
          ) : artworks.length === 1 ? (
            <Image
              src={artworks[0]}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
              priority={priority}
              unoptimized={artworks[0]?.startsWith("/api/")}
            />
          ) : (
            <div className="grid size-full grid-cols-2 grid-rows-2 gap-[1px]">
              {[0, 1, 2, 3].map((i) =>
                artworks[i] ? (
                  <div key={i} className="relative overflow-hidden">
                    <Image
                      src={artworks[i]}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 25vw, (max-width: 1024px) 17vw, 12vw"
                      className="object-cover"
                      priority={priority && i === 0}
                      unoptimized={artworks[i]?.startsWith("/api/")}
                    />
                  </div>
                ) : (
                  <div key={i} className="bg-muted" />
                )
              )}
            </div>
          )}

          {/* Hover overlay */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-end p-3",
              "bg-black/60 backdrop-blur-sm",
              "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            )}
          >
            {playlist.description && (
              <p className="line-clamp-2 text-xs text-white/80">
                {playlist.description}
              </p>
            )}
            <p className="mt-1 text-xs font-medium text-white/60">
              {playlist.itemCount} {playlist.itemCount === 1 ? "item" : "items"}
            </p>
          </div>
        </div>

        {/* Name and count */}
        <div>
          <p className="line-clamp-1 text-sm leading-tight font-medium">
            {playlist.name}
          </p>
          <p className="text-xs text-[var(--tertiary-foreground)]">
            {playlist.itemCount} {playlist.itemCount === 1 ? "item" : "items"}
          </p>
        </div>
      </Link>
    );
  }
);
