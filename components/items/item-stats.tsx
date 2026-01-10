/**
 * Reusable stats display for items.
 * Shows child count and file counts (media, artwork, subtitles).
 * Used in GridItem, TreeItem, and ItemSettingsDialog.
 */

"use client";

import {
  Folder,
  Film,
  ImageIcon,
  FileText,
  Music,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileCounts } from "@/lib/types";

export type { FileCounts };

interface ItemStatsProps {
  /** Number of child items */
  childCount?: number;
  /** File counts by type */
  fileCounts?: FileCounts;
  /** Media icon type: film (all video), music (all audio), mixed (both) */
  mediaIconType?: "film" | "music" | "mixed" | null;
  /** Visual variant - overlay (white text) or muted (muted-foreground) */
  variant?: "overlay" | "muted";
  /** Display format - icons (with icons) or text (x2 children, x2 media) */
  format?: "icons" | "text";
  /** Whether to show empty state when no content */
  showEmpty?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Displays item statistics (children and file counts).
 * Supports two variants: "overlay" for dark backgrounds, "muted" for light.
 * Supports two formats: "icons" with icons, "text" with "x2 children" style.
 *
 * @param childCount - Number of child items
 * @param fileCounts - File counts by type (media, artwork, subtitles)
 * @param mediaIconType - Icon type: film (video), music (audio), mixed (both)
 * @param variant - Visual style variant (default: "muted")
 * @param format - Display format (default: "icons")
 * @param showEmpty - Whether to show "Empty" when no content (default: false)
 * @param className - Additional CSS classes
 */
export function ItemStats({
  childCount = 0,
  fileCounts = { media: 0, artwork: 0, subtitles: 0 },
  mediaIconType,
  variant = "muted",
  format = "icons",
  showEmpty = false,
  className,
}: ItemStatsProps) {
  const hasChildren = childCount > 0;
  const hasFiles =
    fileCounts.media > 0 || fileCounts.artwork > 0 || fileCounts.subtitles > 0;
  const hasContent = hasChildren || hasFiles;

  // Determine icon: Film (video), Music (audio), FolderOpen (mixed)
  const MediaIcon =
    mediaIconType === "music"
      ? Music
      : mediaIconType === "mixed"
        ? FolderOpen
        : Film;

  if (!hasContent && !showEmpty) {
    return null;
  }

  const textClass =
    variant === "overlay" ? "text-white/90" : "text-muted-foreground";
  const emptyClass =
    variant === "overlay" ? "text-white/60" : "text-muted-foreground";

  if (!hasContent && showEmpty) {
    return (
      <span
        className={cn("text-sm", emptyClass, className)}
        data-testid="empty-state"
      >
        Empty
      </span>
    );
  }

  // Text format: "x2 children, x3 media, x1 artwork"
  if (format === "text") {
    const parts: string[] = [];
    if (hasChildren) {
      parts.push(`x${childCount} ${childCount === 1 ? "child" : "children"}`);
    }
    if (fileCounts.media > 0) {
      parts.push(`x${fileCounts.media} media`);
    }
    if (fileCounts.artwork > 0) {
      parts.push(`x${fileCounts.artwork} artwork`);
    }
    if (fileCounts.subtitles > 0) {
      parts.push(
        `x${fileCounts.subtitles} ${fileCounts.subtitles === 1 ? "subtitle" : "subtitles"}`
      );
    }

    return (
      <span
        className={cn("text-sm", textClass, className)}
        data-testid="item-stats"
      >
        {parts.join(", ")}
      </span>
    );
  }

  // Icons format (default)
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 text-sm",
        textClass,
        className
      )}
      data-testid="item-stats"
    >
      {hasChildren && (
        <span className="flex items-center gap-1.5" data-testid="child-count">
          <Folder className="size-4" />
          <span>
            {childCount} {childCount === 1 ? "child" : "children"}
          </span>
        </span>
      )}
      {fileCounts.media > 0 && (
        <span className="flex items-center gap-1.5" data-testid="media-count">
          <MediaIcon className="size-4" />
          <span>{fileCounts.media}</span>
        </span>
      )}
      {fileCounts.artwork > 0 && (
        <span className="flex items-center gap-1.5" data-testid="artwork-count">
          <ImageIcon className="size-4" />
          <span>{fileCounts.artwork}</span>
        </span>
      )}
      {fileCounts.subtitles > 0 && (
        <span
          className="flex items-center gap-1.5"
          data-testid="subtitle-count"
        >
          <FileText className="size-4" />
          <span>{fileCounts.subtitles}</span>
        </span>
      )}
    </div>
  );
}
