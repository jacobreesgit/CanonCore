/**
 * Playlist card using the shared CardShell visual system.
 * Renders a 2×2 poster collage from TMDB thumbnails, with hover overlay.
 * Wraps CardShell in a <Link> for navigation to playlist detail.
 */

"use client";

import { forwardRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ListMusic, Eye, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardShell } from "@/components/ui/card-shell";
import { getTmdbPosterUrl } from "@/lib/tmdb-image-utils";

interface PlaylistGridItemProps {
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

export const PlaylistGridItem = forwardRef<
  HTMLAnchorElement,
  PlaylistGridItemProps
>(function PlaylistGridItem(
  { playlist, username, priority = false, isOwner = false },
  ref
) {
  const href = `/u/${username}/playlists/${playlist.id}`;

  // Resolve poster URLs from preview data
  const posterUrls = playlist.previewPosters.map((p) =>
    p.tmdbPosterPath
      ? getTmdbPosterUrl(p.tmdbPosterPath, "w342")
      : p.artworkId
        ? `/api/artwork/${p.artworkId}`
        : null
  );

  const hasPosters = posterUrls.some(Boolean);

  // Artwork area
  const artwork = playlist.hasArtwork ? (
    // Custom uploaded artwork — single full-bleed image
    <Image
      src={`/api/playlist/artwork?playlistId=${playlist.id}`}
      alt=""
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      className="object-cover"
      priority={priority}
      unoptimized
    />
  ) : hasPosters ? (
    // 2×2 poster collage
    <div className="grid size-full grid-cols-2 grid-rows-2 gap-[1px]">
      {[0, 1, 2, 3].map((i) => {
        const url = posterUrls[i];
        return url ? (
          <div key={i} className="relative overflow-hidden">
            <Image
              src={url}
              alt=""
              fill
              sizes="(max-width: 640px) 25vw, (max-width: 1024px) 17vw, 12vw"
              className="object-cover"
              priority={priority && i === 0}
              unoptimized={url.startsWith("/api/")}
            />
          </div>
        ) : (
          <div key={i} className="bg-muted" />
        );
      })}
    </div>
  ) : (
    // Fallback — icon on muted gradient
    <div className="from-card to-background flex size-full items-center justify-center bg-gradient-to-br">
      <ListMusic className="text-muted-foreground/40 size-10" />
    </div>
  );

  // Default view — playlist name (always visible)
  const defaultContent = (
    <div className="flex items-center gap-1.5">
      <h3
        className={cn(
          "min-w-0 truncate text-xs font-semibold tracking-tight",
          "text-white drop-shadow-lg",
          "md:text-sm"
        )}
      >
        {playlist.name}
      </h3>
    </div>
  );

  // Hover overlay — name, description, item count, visibility badge
  const overlay = (
    <>
      {/* Visibility badge (owner only) */}
      {isOwner && playlist.isPublic !== undefined && (
        <div className="mb-auto flex justify-end">
          {playlist.isPublic ? (
            <Eye className="size-3.5 text-white/60" />
          ) : (
            <Lock className="size-3.5 text-white/60" />
          )}
        </div>
      )}

      {/* Title */}
      <h3
        className={cn(
          "min-w-0 truncate text-xs font-semibold tracking-tight",
          "text-white",
          "md:text-sm"
        )}
      >
        {playlist.name}
      </h3>

      {/* Description */}
      {playlist.description && (
        <p className="mt-1 line-clamp-2 text-xs text-white/80">
          {playlist.description}
        </p>
      )}

      {/* Item count */}
      <p className="mt-1 text-xs font-medium text-white/60">
        {playlist.itemCount} {playlist.itemCount === 1 ? "item" : "items"}
      </p>
    </>
  );

  return (
    <Link
      ref={ref}
      href={href}
      className="group block outline-none"
      data-testid={`playlist-card-${playlist.id}`}
    >
      <CardShell defaultContent={defaultContent} overlay={overlay}>
        {artwork}
      </CardShell>
    </Link>
  );
});
