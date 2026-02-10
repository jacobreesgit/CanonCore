/**
 * Avatar sub-component for CinematicHero profile mode.
 * Renders profile image with skeleton loading and initials fallback.
 * Large format with glass-morphism border to match the cinematic hero system.
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
 * Avatar with glass-morphism border and initials gradient fallback.
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
      {/* Glass border ring */}
      <div
        className={cn(
          "relative rounded-full p-[3px]",
          "bg-gradient-to-b from-white/20 via-white/8 to-white/4"
        )}
      >
        {/* Inner avatar */}
        <div
          className={cn(
            "relative size-28 overflow-hidden rounded-full",
            "sm:size-32 md:size-44 lg:size-48",
            "ring-1 ring-white/10"
          )}
        >
          {hasImage && !error ? (
            <>
              {!loaded && (
                <Skeleton className="absolute inset-0 rounded-full" />
              )}
              <Image
                src={`/api/user/avatar?userId=${userId}`}
                alt={displayName}
                fill
                sizes="(max-width: 640px) 112px, (max-width: 768px) 128px, (max-width: 1024px) 176px, 192px"
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
              className="relative flex h-full w-full items-center justify-center text-4xl font-semibold tracking-tight text-white md:text-5xl"
              style={{ background: getInitialsGradient(userId) }}
            >
              {/* Glass overlay on initials */}
              <div
                className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"
                aria-hidden="true"
              />
              <span className="relative drop-shadow-sm">
                {getInitials(name, username)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
