/**
 * Playlist card with 2x2 artwork collage, name, and item count.
 * Used in playlist grids on profile pages (owner and viewer modes).
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaylistCardProps {
  /** Playlist data. */
  playlist: {
    id: string;
    name: string;
    itemCount: number;
    previewArtworkIds: (string | null)[];
  };
  /** Profile username for URL construction. */
  username: string;
  /** Whether to prioritise image loading (above-the-fold). */
  priority?: boolean;
}

/**
 * Displays a playlist as a card with a 2x2 artwork collage.
 * Links to the playlist detail page.
 *
 * @param playlist - Playlist data including preview artwork
 * @param username - Profile username for URL construction
 * @param priority - Whether to prioritise image loading
 */
export function PlaylistCard({
  playlist,
  username,
  priority = false,
}: PlaylistCardProps) {
  const artworks = playlist.previewArtworkIds.filter(Boolean) as string[];
  const href = `/u/${username}/playlists/${playlist.id}`;

  return (
    <Link
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
        {artworks.length === 0 ? (
          <div className="flex size-full items-center justify-center">
            <ListMusic className="text-muted-foreground/40 size-10" />
          </div>
        ) : artworks.length === 1 ? (
          <Image
            src={`/api/artwork/${artworks[0]}`}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="grid size-full grid-cols-2 grid-rows-2 gap-[1px]">
            {[0, 1, 2, 3].map((i) =>
              artworks[i] ? (
                <div key={i} className="relative overflow-hidden">
                  <Image
                    src={`/api/artwork/${artworks[i]}`}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 25vw, (max-width: 1024px) 17vw, 12vw"
                    className="object-cover"
                    priority={priority && i === 0}
                  />
                </div>
              ) : (
                <div key={i} className="bg-muted" />
              )
            )}
          </div>
        )}
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
