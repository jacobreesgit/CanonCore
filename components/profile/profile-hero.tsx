/**
 * Profile hero component with cover photo and avatar.
 * Features Facebook-style layout with avatar overlapping the cover edge.
 * Uses cinematic editorial design with motion animations.
 */

"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Shader1 } from "@/components/shader1";
import type { PublicProfile } from "@/lib/public-auth";

interface ProfileHeroProps {
  /** Profile data to display */
  profile: PublicProfile;
  /** Whether this is the current user's own profile */
  isOwnProfile?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Generates a gradient background based on a string (username/id).
 * Creates consistent colors for the same user.
 */
function getInitialsGradient(seed: string): string {
  // Simple hash to get consistent hue
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  // Rich, saturated gradient
  return `linear-gradient(135deg, hsl(${hue}, 70%, 45%) 0%, hsl(${(hue + 40) % 360}, 80%, 35%) 100%)`;
}

/**
 * Gets the initials from a name or username.
 */
function getInitials(name: string | null, username: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  }
  return username[0].toUpperCase();
}

/**
 * Profile hero with cover photo and avatar.
 * Features Facebook-style layout with cinematic feel.
 */
export function ProfileHero({
  profile,
  isOwnProfile = false,
  className,
}: ProfileHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const displayName = profile.name ?? `@${profile.username}`;
  const initials = getInitials(profile.name, profile.username);
  const initialsGradient = getInitialsGradient(profile.id);

  // Image URLs
  const coverUrl = profile.hasHeroImage
    ? `/api/user/hero?userId=${profile.id}`
    : null;
  const avatarUrl = profile.hasImage
    ? `/api/user/avatar?userId=${profile.id}`
    : null;

  const handleCoverLoad = useCallback(() => setCoverLoaded(true), []);
  const handleAvatarLoad = useCallback(() => setAvatarLoaded(true), []);
  const handleAvatarError = useCallback(() => {
    setAvatarError(true);
    setAvatarLoaded(true);
  }, []);

  // Motion variants
  const containerVariants = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.5 },
      };

  const avatarVariants = prefersReducedMotion
    ? {}
    : {
        initial: { scale: 0.9, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: {
          type: "spring" as const,
          stiffness: 200,
          damping: 20,
          delay: 0.2,
        },
      };

  const textVariants = prefersReducedMotion
    ? {}
    : {
        initial: { y: 20, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { duration: 0.4, delay: 0.3 },
      };

  const Wrapper = prefersReducedMotion ? "div" : motion.div;
  const AvatarWrapper = prefersReducedMotion ? "div" : motion.div;
  const TextWrapper = prefersReducedMotion ? "div" : motion.div;

  return (
    <section data-testid="profile-hero" className={cn("relative", className)}>
      <Wrapper {...containerVariants}>
        <div className="p-1">
          {/* Main hero container */}
          <div className="bg-muted relative flex h-[max(280px,35dvh)] flex-col overflow-hidden rounded-xl">
            {/* Loading skeleton for cover */}
            {coverUrl && !coverLoaded && (
              <Skeleton className="absolute inset-0 rounded-xl" />
            )}

            {/* Cover photo or shader fallback */}
            <div className="pointer-events-none absolute inset-0">
              {coverUrl ? (
                <>
                  <Image
                    src={coverUrl}
                    alt=""
                    fill
                    sizes="100vw"
                    className={cn(
                      "object-cover transition-opacity duration-500",
                      coverLoaded ? "opacity-100" : "opacity-0"
                    )}
                    priority
                    onLoad={handleCoverLoad}
                    onError={handleCoverLoad}
                    unoptimized
                  />
                  {/* Dark gradient overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
                </>
              ) : typeof window !== "undefined" && navigator.webdriver ? (
                <div className="h-full w-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
              ) : (
                <>
                  <Shader1 className="h-full w-full" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                </>
              )}
            </div>

            {/* Content area - positioned at bottom */}
            <div className="relative z-10 mt-auto flex items-end gap-5 p-6 pb-8 md:gap-6 md:p-8 md:pb-10">
              {/* Avatar */}
              <AvatarWrapper
                {...avatarVariants}
                className="group/avatar relative shrink-0"
              >
                <div
                  className={cn(
                    "relative h-32 w-32 overflow-hidden rounded-full md:h-44 md:w-44 lg:h-52 lg:w-52",
                    "ring-background shadow-2xl ring-4",
                    "after:absolute after:inset-0 after:rounded-full after:ring-2 after:ring-white/20 after:ring-inset"
                  )}
                >
                  {avatarUrl && !avatarError ? (
                    <>
                      {/* Avatar loading skeleton */}
                      {!avatarLoaded && (
                        <Skeleton className="absolute inset-0 rounded-full" />
                      )}
                      <Image
                        src={avatarUrl}
                        alt={displayName}
                        fill
                        sizes="(max-width: 768px) 128px, (max-width: 1024px) 176px, 208px"
                        className={cn(
                          "object-cover transition-opacity duration-300",
                          avatarLoaded ? "opacity-100" : "opacity-0"
                        )}
                        onLoad={handleAvatarLoad}
                        onError={handleAvatarError}
                        unoptimized
                      />
                    </>
                  ) : (
                    /* Initials fallback */
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: initialsGradient }}
                    >
                      <span className="text-3xl font-bold text-white md:text-4xl">
                        {initials}
                      </span>
                    </div>
                  )}
                </div>

                {/* Subtle glow effect behind avatar */}
                <div
                  className="absolute -inset-2 -z-10 rounded-full opacity-40 blur-xl"
                  style={{ background: initialsGradient }}
                />
              </AvatarWrapper>

              {/* Name and username */}
              <TextWrapper {...textVariants} className="min-w-0 flex-1 pb-1">
                <h1 className="truncate text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                  {displayName}
                </h1>
                <p className="mt-1 truncate text-base text-white/60 md:text-lg">
                  {isOwnProfile
                    ? "Your public profile"
                    : `@${profile.username}`}
                </p>
              </TextWrapper>
            </div>
          </div>
        </div>
      </Wrapper>
    </section>
  );
}
