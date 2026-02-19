/**
 * Playlist card using the shared CardShell visual system.
 * Poster layout adapts to count: 1=full-bleed, 2=side-by-side, 3=1-top+2-bottom, 4=2×2 grid.
 * Wraps CardShell in a <Link> for navigation to playlist detail.
 */

"use client";

import { forwardRef, type ReactNode } from "react";
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

  // Resolve poster URLs from preview data (filter to valid only)
  const validPosters = playlist.previewPosters
    .map((p) =>
      p.tmdbPosterPath
        ? getTmdbPosterUrl(p.tmdbPosterPath, "w342")
        : p.artworkId
          ? `/api/artwork/${p.artworkId}`
          : null
    )
    .filter(Boolean) as string[];

  const posterCount = validPosters.length;

  // Render a single poster tile
  const renderTile = (
    url: string,
    i: number,
    sizes: string,
    className?: string
  ) => (
    <div key={i} className={cn("relative overflow-hidden", className)}>
      <Image
        src={url}
        alt=""
        fill
        sizes={sizes}
        className="object-cover"
        priority={priority && i === 0}
        unoptimized={url.startsWith("/api/")}
      />
    </div>
  );

  // Artwork area — layout adapts to number of available posters
  let artwork: ReactNode;

  if (playlist.hasArtwork) {
    // Custom uploaded artwork — single full-bleed image
    artwork = (
      <Image
        src={`/api/playlist/artwork?playlistId=${playlist.id}`}
        alt=""
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover"
        priority={priority}
        unoptimized
      />
    );
  } else if (posterCount >= 4) {
    // 4+ posters: 2×2 grid
    artwork = (
      <div className="grid size-full grid-cols-2 grid-rows-2 gap-[1px]">
        {validPosters
          .slice(0, 4)
          .map((url, i) =>
            renderTile(
              url,
              i,
              "(max-width: 640px) 25vw, (max-width: 1024px) 17vw, 12vw"
            )
          )}
      </div>
    );
  } else if (posterCount === 3) {
    // 3 posters: 1 spanning top + 2 bottom
    artwork = (
      <div className="grid size-full grid-cols-2 grid-rows-2 gap-[1px]">
        {renderTile(
          validPosters[0],
          0,
          "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
          "col-span-2"
        )}
        {renderTile(
          validPosters[1],
          1,
          "(max-width: 640px) 25vw, (max-width: 1024px) 17vw, 12vw"
        )}
        {renderTile(
          validPosters[2],
          2,
          "(max-width: 640px) 25vw, (max-width: 1024px) 17vw, 12vw"
        )}
      </div>
    );
  } else if (posterCount === 2) {
    // 2 posters: side by side
    artwork = (
      <div className="grid size-full grid-cols-2 gap-[1px]">
        {validPosters.map((url, i) =>
          renderTile(
            url,
            i,
            "(max-width: 640px) 25vw, (max-width: 1024px) 17vw, 12vw"
          )
        )}
      </div>
    );
  } else if (posterCount === 1) {
    // 1 poster: single full-bleed
    artwork = (
      <Image
        src={validPosters[0]}
        alt=""
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover"
        priority={priority}
        unoptimized={validPosters[0].startsWith("/api/")}
      />
    );
  } else {
    // 0 posters: icon fallback
    artwork = (
      <div className="from-card to-background flex size-full items-center justify-center bg-gradient-to-br">
        <ListMusic className="text-muted-foreground/40 size-10" />
      </div>
    );
  }

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
