/**
 * Shared types for the CinematicHero component.
 */

import type { SyncStatus } from "@/lib/types";

/**
 * Data for a single hero slide.
 * Supports item detail, carousel, and profile avatar modes.
 */
export interface HeroSlide {
  /** Unique identifier. */
  id: string;
  /** Title displayed on the slide. */
  name: string;
  /** Optional description text. */
  description?: string | null;
  /** Artwork file ID for background image (used via /api/artwork/{id}). */
  artworkId?: string | null;
  /** Direct URL for background image. Takes precedence over artworkId. */
  backgroundUrl?: string | null;
  /** Link destination (used by renderActions for CTA). */
  link?: string;
  /** TMDB tagline (e.g., "Long live the fighters."). */
  tagline?: string;
  /** TMDB metadata for MetadataLine display. */
  metadata?: {
    year?: string;
    runtime?: number;
    contentRating?: string;
    voteAverage?: number;
  };
  /** Genre names displayed inline in the metadata line. */
  genres?: string[];
  /** Progress percentage (0-100). */
  progress?: number;
  /** Progress label (e.g., "5/10 watched"). */
  progressLabel?: string;
  /** Attribution text above title (e.g., "Shared by @username"). */
  attribution?: string;
  /** Link destination for the attribution text. */
  attributionHref?: string;
  /** Sync status for displaying indicator (e.g., SYNCING, PENDING, ERROR, SYNCED). */
  syncStatus?: SyncStatus;
  /** Google Drive folder ID — shows cloud icon when linked and synced. */
  driveFileId?: string | null;
  /** Logo image URL for display instead of text title. */
  logoImage?: string | null;
  /** Dominant colour extracted from backdrop (hex, e.g. "#1a3a5c"). */
  dominantColour?: string | null;
  /** Profile data — when present, renders avatar layout. */
  profile?: {
    id: string;
    username: string;
    name: string | null;
    hasImage: boolean;
  };
}

/**
 * Props for CinematicHero component.
 */
export interface CinematicHeroProps {
  /** Slides to display. Single slide = static hero; multiple = carousel. */
  slides: HeroSlide[];
  /** Per-slide action renderer (for multi-slide carousel mode). */
  renderActions?: (slide: HeroSlide) => React.ReactNode;
  /** Static action buttons (for single-slide item detail mode). */
  actions?: React.ReactNode;
  /** Heading level for the title. */
  headingLevel?: "h1" | "h2";
  /** Auto-advance interval in ms (0 to disable, default 5000). */
  autoAdvanceInterval?: number;
  /** Enable Ken Burns animation on backdrop (default true). */
  enableKenBurns?: boolean;
  /** Custom background element (e.g., mosaic). Renders instead of Image/video when provided. */
  backgroundElement?: React.ReactNode;
  /** Callback fired when the active slide's dominant colour changes (for page-level theming). */
  onColourChange?: (colour: string | null) => void;
  /** Additional CSS classes. */
  className?: string;
}
