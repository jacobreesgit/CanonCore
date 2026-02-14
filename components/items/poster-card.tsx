/**
 * Poster card with hover-reveal info overlay.
 * Consistent 2:3 aspect ratio across all breakpoints.
 */

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/progress-bar";

interface PosterCardProps {
  /** Poster image URL. */
  posterUrl: string | null;
  /** Item title. */
  title: string;
  /** Optional description (shown on hover). */
  description?: string;
  /** Optional owner info (shown on hover). */
  owner?: { name: string; username: string };
  /** Progress percentage (0-100). */
  progress?: number;
  /** Link destination. */
  href?: string;
  /** Optional click handler. When provided without href, renders as button instead of Link. */
  onClick?: () => void;
  /** Accessible label for the interactive element (overrides title-derived name). */
  "aria-label"?: string;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Movie/TV poster card with hover state for desktop.
 * Title always visible for accessibility, full overlay on hover/focus.
 * Renders as Link by default, or as button when onClick is provided.
 */
export function PosterCard({
  posterUrl,
  title,
  description,
  owner,
  progress,
  href = "#",
  onClick,
  "aria-label": ariaLabel,
  className,
}: PosterCardProps) {
  const sharedClassName = cn(
    "group relative block overflow-hidden rounded-lg",
    "aspect-[2/3]",
    "bg-card",
    "transition-[color,background-color,border-color,opacity,transform,box-shadow] duration-300 ease-out",
    "hover:z-10 hover:scale-105",
    "hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
    "focus-visible:z-10 focus-visible:scale-105",
    "focus-visible:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
    "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none",
    "active:scale-[0.98] active:transition-transform active:duration-100",
    className
  );

  const content = (
    <>
      {/* Poster Image */}
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          className="object-cover"
        />
      ) : (
        /* Fallback with title initial */
        <div className="from-card to-background absolute inset-0 flex items-center justify-center bg-gradient-to-br">
          <span className="text-4xl font-bold text-white/20">
            {title.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Default Gradient (always visible) */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* Title (always visible for a11y) */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3
          className={cn(
            "truncate text-sm font-semibold tracking-tight",
            "text-white drop-shadow-lg",
            "md:text-base"
          )}
        >
          {title}
        </h3>
      </div>

      {/* Hover/Focus Overlay */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-end p-3",
          "opacity-0 transition-opacity duration-200",
          "group-hover:opacity-100 group-focus-visible:opacity-100"
        )}
        style={{ background: "var(--gradient-card)" }}
        aria-hidden="true"
      >
        {/* Title (redundant but styled differently in overlay) */}
        <h3
          className={cn(
            "text-sm font-semibold tracking-tight",
            "text-white",
            "md:text-base"
          )}
        >
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="mt-1 line-clamp-2 text-xs text-white/60 md:text-sm">
            {description}
          </p>
        )}

        {/* Owner */}
        {owner && (
          <p className="mt-1 text-xs text-white/50">@{owner.username}</p>
        )}

        {/* Progress */}
        {typeof progress === "number" && (
          <div className="mt-2">
            <ProgressBar progress={progress} compact />
          </div>
        )}
      </div>
    </>
  );

  // Render as button when onClick is provided (avoids nested interactive elements)
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={sharedClassName}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={href} aria-label={ariaLabel} className={sharedClassName}>
      {content}
    </Link>
  );
}
