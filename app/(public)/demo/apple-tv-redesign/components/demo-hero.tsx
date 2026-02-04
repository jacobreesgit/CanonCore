/**
 * Full-bleed hero section with cinematic backdrop and gradient overlays.
 * The centerpiece of the Apple TV+ aesthetic - content floats on imagery.
 */

import Image from "next/image";
import { cn } from "@/lib/utils";
import { DemoMetadataLine } from "./demo-metadata-line";
import { DemoGenrePills } from "./demo-genre-pills";
import { DemoProgressBar } from "./demo-progress-bar";

/** Hero height variants based on content type. */
type HeroVariant = "item" | "container" | "explore" | "profile";

interface DemoHeroProps {
  /** Backdrop image URL (full TMDB URL). */
  backdropUrl: string | null;
  /** Main title. */
  title: string;
  /** Optional tagline (e.g., "Long live the fighters."). */
  tagline?: string;
  /** Description text. */
  description?: string;
  /** Metadata for the metadata line. */
  metadata?: {
    year?: string;
    runtime?: number;
    contentRating?: string;
    voteAverage?: number;
  };
  /** Genre names for pills. */
  genres?: string[];
  /** Progress percentage (0-100). */
  progress?: number;
  /** Progress label (e.g., "72% watched" or "12/19 episodes"). */
  progressLabel?: string;
  /** Hero height variant. */
  variant?: HeroVariant;
  /** Optional action buttons slot. */
  actions?: React.ReactNode;
  /** Optional attribution slot (owner badge for public items). */
  attribution?: React.ReactNode;
  /** Optional poster image for profile variant. */
  posterUrl?: string | null;
  /** Enable Ken Burns animation on backdrop. */
  enableKenBurns?: boolean;
}

/** Height classes by variant. */
const variantHeights: Record<HeroVariant, string> = {
  item: "h-[55vh] md:h-[65vh]",
  container: "h-[40vh] md:h-[50vh]",
  explore: "h-[40vh] md:h-[50vh]",
  profile: "h-[40vh] md:h-[50vh]",
};

/**
 * Cinematic hero section with full-bleed backdrop and floating content.
 */
export function DemoHero({
  backdropUrl,
  title,
  tagline,
  description,
  metadata,
  genres,
  progress,
  progressLabel,
  variant = "item",
  actions,
  attribution,
  enableKenBurns = true,
}: DemoHeroProps) {
  return (
    <section
      className={cn("relative w-full overflow-hidden", variantHeights[variant])}
    >
      {/* ═══════════════════════════════════════════════════════════
          Backdrop Image
          ═══════════════════════════════════════════════════════════ */}
      {backdropUrl ? (
        <div className="absolute inset-0">
          <Image
            src={backdropUrl}
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className={cn(
              "object-cover object-center",
              enableKenBurns && "atv-ken-burns"
            )}
          />
        </div>
      ) : (
        /* Fallback gradient when no backdrop */
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--atv-surface)] to-[var(--atv-bg)]" />
      )}

      {/* ═══════════════════════════════════════════════════════════
          Gradient Overlays
          ═══════════════════════════════════════════════════════════ */}
      {/* Top vignette for subtle darkening */}
      <div
        className="absolute inset-x-0 top-0 h-[30%]"
        style={{ background: "var(--atv-gradient-top)" }}
        aria-hidden="true"
      />

      {/* Bottom gradient for text legibility */}
      <div
        className="absolute inset-x-0 bottom-0 h-[70%]"
        style={{ background: "var(--atv-gradient-hero)" }}
        aria-hidden="true"
      />

      {/* ═══════════════════════════════════════════════════════════
          Content
          ═══════════════════════════════════════════════════════════ */}
      <div className="atv-animate-slide-up absolute inset-x-0 bottom-0 z-10">
        <div
          className={cn(
            "px-[var(--atv-px-mobile)] pb-8",
            "sm:px-[var(--atv-px-sm)]",
            "md:px-[var(--atv-px-md)] md:pb-12",
            "lg:px-[var(--atv-px-lg)]",
            "xl:px-[var(--atv-px-xl)]",
            "2xl:px-[var(--atv-px-2xl)]"
          )}
        >
          {/* Attribution (owner badge) */}
          {attribution && <div className="mb-3">{attribution}</div>}

          {/* Title */}
          <h1
            className={cn(
              "font-bold tracking-tight text-balance",
              "text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl",
              "text-white drop-shadow-lg"
            )}
            style={{ fontFamily: "var(--atv-font-display)" }}
          >
            {title}
          </h1>

          {/* Tagline */}
          {tagline && (
            <p
              className={cn("mt-2 text-lg italic md:text-xl", "text-white/70")}
            >
              &ldquo;{tagline}&rdquo;
            </p>
          )}

          {/* Metadata line */}
          {metadata && (
            <div className="mt-4">
              <DemoMetadataLine
                year={metadata.year}
                runtime={metadata.runtime}
                contentRating={metadata.contentRating}
                voteAverage={metadata.voteAverage}
              />
            </div>
          )}

          {/* Genre pills */}
          {genres && genres.length > 0 && (
            <div className="mt-4">
              <DemoGenrePills genres={genres} />
            </div>
          )}

          {/* Description */}
          {description && (
            <p
              className={cn(
                "mt-4 max-w-2xl text-base leading-relaxed md:text-lg",
                "line-clamp-2 text-white/70"
              )}
            >
              {description}
            </p>
          )}

          {/* Progress bar */}
          {typeof progress === "number" && (
            <div className="mt-5">
              <DemoProgressBar progress={progress} label={progressLabel} />
            </div>
          )}

          {/* Action buttons */}
          {actions && (
            <div className="mt-5 flex flex-wrap gap-3">{actions}</div>
          )}
        </div>
      </div>
    </section>
  );
}
