/**
 * Horizontal scrolling cast row with circular profile photos.
 * Shows top cast members with name and character.
 */

"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DemoCastMember } from "../lib/tmdb-demo";
import { getProfileImageUrl } from "../lib/tmdb-demo";

interface DemoCastRowProps {
  /** Cast members to display. */
  cast: DemoCastMember[];
  /** Section title. */
  title?: string;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Horizontal scrollable row of cast member cards.
 * Clicking shows "Person pages coming soon" toast.
 */
export function DemoCastRow({
  cast,
  title = "Cast & Crew",
  className,
}: DemoCastRowProps) {
  if (cast.length === 0) return null;

  const handlePersonClick = (name: string) => {
    toast.info(`Person pages coming soon`, {
      description: `${name}'s filmography will be available in a future update.`,
    });
  };

  return (
    <section className={className}>
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <h2
          className={cn(
            "text-xs font-medium tracking-[0.2em] uppercase",
            "text-[var(--atv-text-tertiary)]"
          )}
        >
          {title}
        </h2>
        <button
          className={cn(
            "text-xs font-medium",
            "text-[var(--atv-text-tertiary)]",
            "hover:text-[var(--atv-text-secondary)]",
            "transition-colors"
          )}
          onClick={() =>
            toast.info("Full cast list coming soon", {
              description: "View all cast and crew members in a future update.",
            })
          }
        >
          See All →
        </button>
      </div>

      {/* Scrollable row */}
      <div
        className={cn(
          "flex gap-4 overflow-x-auto pb-2",
          "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10",
          "snap-x snap-mandatory"
        )}
      >
        {cast.map((member) => (
          <button
            key={member.id}
            onClick={() => handlePersonClick(member.name)}
            className={cn(
              "flex flex-shrink-0 flex-col items-center gap-2",
              "w-20 snap-start",
              "group cursor-pointer",
              "focus-visible:outline-none"
            )}
          >
            {/* Profile photo */}
            <div
              className={cn(
                "relative size-16 overflow-hidden rounded-full",
                "bg-[var(--atv-surface)]",
                "ring-2 ring-transparent",
                "transition-all duration-200",
                "group-hover:ring-white/30",
                "group-focus-visible:ring-white"
              )}
            >
              {getProfileImageUrl(member.profilePath) ? (
                <Image
                  src={getProfileImageUrl(member.profilePath)!}
                  alt={member.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                /* Fallback initials */
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
                  <span className="text-lg font-semibold text-white/40">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                </div>
              )}
            </div>

            {/* Name */}
            <span
              className={cn(
                "w-full truncate text-center text-xs font-medium",
                "text-[var(--atv-text-primary)]"
              )}
            >
              {member.name}
            </span>

            {/* Character/Role */}
            <span
              className={cn(
                "-mt-1 w-full truncate text-center text-xs",
                "text-[var(--atv-text-tertiary)]"
              )}
            >
              {member.character}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
