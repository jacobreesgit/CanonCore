/**
 * Avatar sub-component for CinematicHero profile mode.
 * Renders profile image with skeleton loading and initials fallback.
 */

"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getInitialsGradient, getInitials } from "@/lib/avatar-utils";
import { Skeleton } from "@/components/ui/skeleton";

interface HeroAvatarProps {
  /** User ID for image URL. */
  userId: string;
  /** Display name for alt text and initials. */
  name: string | null;
  /** Username for initials fallback. */
  username: string;
  /** Whether user has an uploaded image. */
  hasImage: boolean;
}

/**
 * Avatar with image loading skeleton and initials gradient fallback.
 */
export function HeroAvatar({
  userId,
  name,
  username,
  hasImage,
}: HeroAvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => {
    setError(true);
    setLoaded(true);
  }, []);

  const displayName = name ?? `@${username}`;

  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "relative size-20 overflow-hidden rounded-full md:size-28 lg:size-32",
          "ring-background ring-4"
        )}
      >
        {hasImage && !error ? (
          <>
            {!loaded && <Skeleton className="absolute inset-0 rounded-full" />}
            <Image
              src={`/api/user/avatar?userId=${userId}`}
              alt={displayName}
              fill
              sizes="(max-width: 768px) 80px, (max-width: 1024px) 112px, 128px"
              className={cn(
                "object-cover transition-opacity duration-300",
                loaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={handleLoad}
              onError={handleError}
              unoptimized
            />
          </>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-2xl font-bold text-white md:text-4xl"
            style={{ background: getInitialsGradient(userId) }}
          >
            {getInitials(name, username)}
          </div>
        )}
      </div>
    </div>
  );
}
