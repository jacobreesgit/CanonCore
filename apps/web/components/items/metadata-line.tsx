/**
 * Metadata line displaying year, runtime, content rating, and vote average.
 * Uses tabular-nums for aligned numbers and subtle separator dots.
 */

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStar,
  faCircleCheck,
  faSpinner,
  faCircle,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { formatRuntime } from "@/lib/tmdb-client";
import { formatDuration, getResolutionLabel } from "@/lib/media-metadata";
import type { SyncStatus } from "@/lib/types";

interface MetadataLineProps {
  /** Release year (e.g., "2024"). */
  year?: string;
  /** Runtime in minutes. */
  runtime?: number;
  /** Content rating (e.g., "PG-13", "TV-MA"). */
  contentRating?: string;
  /** Vote average (0-10). */
  voteAverage?: number;
  /** Genre names to display inline. */
  genres?: string[];
  /** Maximum number of genres to show. */
  maxGenres?: number;
  /** Sync status for displaying indicator. */
  syncStatus?: SyncStatus;
  /** Google Drive folder ID — shows synced indicator when linked. */
  driveFileId?: string | null;
  /** Primary file duration in ms (fallback when no TMDB runtime). */
  durationMs?: number | null;
  /** Primary file height in pixels for resolution label. */
  height?: number | null;
  /** Attribution text (e.g., "Shared by @username"). */
  attribution?: string;
  /** Link destination for the attribution text. */
  attributionHref?: string;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Displays metadata in format: "2024 • 2h 46m • PG-13 • ★ 8.8"
 */
export function MetadataLine({
  year,
  runtime,
  contentRating,
  voteAverage,
  genres,
  maxGenres = 3,
  syncStatus,
  driveFileId,
  durationMs,
  height,
  attribution,
  attributionHref,
  className,
}: MetadataLineProps) {
  const items: React.ReactNode[] = [];

  if (year) {
    items.push(<span key="year">{year}</span>);
  }

  if (runtime) {
    items.push(<span key="runtime">{formatRuntime(runtime)}</span>);
  } else if (durationMs) {
    const formatted = formatDuration(durationMs);
    if (formatted) {
      items.push(<span key="duration">{formatted}</span>);
    }
  }

  // Resolution label from file metadata
  const resolutionLabel = getResolutionLabel(height);
  if (resolutionLabel) {
    items.push(<span key="resolution">{resolutionLabel}</span>);
  }

  if (contentRating && contentRating !== "NR") {
    items.push(
      <span
        key="rating"
        className="rounded border border-white/30 px-1.5 py-0.5 text-xs"
      >
        {contentRating}
      </span>
    );
  }

  if (typeof voteAverage === "number" && voteAverage > 0) {
    items.push(
      <span key="vote" className="inline-flex items-center gap-1">
        <FontAwesomeIcon
          icon={faStar}
          className="size-3.5"
          aria-hidden="true"
        />
        <span>{voteAverage.toFixed(1)}</span>
      </span>
    );
  }

  if (genres && genres.length > 0) {
    const visibleGenres = genres.slice(0, maxGenres);
    items.push(<span key="genres">{visibleGenres.join(", ")}</span>);
  }

  // Sync status indicator with icon + label
  if (syncStatus === "SYNCING") {
    items.push(
      <span key="sync" className="inline-flex items-center gap-1.5">
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          className="size-3.5"
          aria-hidden="true"
        />
        <span>Syncing</span>
      </span>
    );
  } else if (syncStatus === "PENDING") {
    items.push(
      <span key="sync" className="inline-flex items-center gap-1.5">
        <FontAwesomeIcon
          icon={faCircle}
          className="size-2"
          aria-hidden="true"
        />
        <span>Pending sync</span>
      </span>
    );
  } else if (syncStatus === "ERROR") {
    items.push(
      <span
        key="sync"
        className="text-destructive inline-flex items-center gap-1.5"
      >
        <FontAwesomeIcon
          icon={faTriangleExclamation}
          className="size-3.5"
          aria-hidden="true"
        />
        <span>Sync failed</span>
      </span>
    );
  } else if (driveFileId && (!syncStatus || syncStatus === "SYNCED")) {
    items.push(
      <span key="sync" className="inline-flex items-center gap-1.5">
        <FontAwesomeIcon
          icon={faCircleCheck}
          className="size-3.5"
          aria-hidden="true"
        />
        <span>Synced</span>
      </span>
    );
  }

  if (attribution) {
    items.push(
      <span key="attribution">
        {attributionHref ? (
          <Link
            href={attributionHref}
            className="pointer-events-auto underline decoration-white/0 underline-offset-2 transition-[text-decoration-color] hover:decoration-white/50"
          >
            {attribution}
          </Link>
        ) : (
          attribution
        )}
      </span>
    );
  }

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1",
        "text-sm tracking-wide tabular-nums",
        "text-white/60",
        className
      )}
    >
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-3">
          {index > 0 && (
            <span className="text-white/30" aria-hidden="true">
              •
            </span>
          )}
          {item}
        </span>
      ))}
    </div>
  );
}
