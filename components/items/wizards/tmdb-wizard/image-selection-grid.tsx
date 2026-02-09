/**
 * Image selection grid for choosing posters or backdrops.
 * Displays TMDB images in a gallery with elegant selection states.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { Check, ImageOff, ImageIcon, SkipForward, Globe } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getPosterUrl, getBackdropUrl } from "@/lib/tmdb-client";
import type { TMDBImage } from "@/lib/tmdb-client";

/**
 * Existing uploaded artwork file.
 */
export interface ExistingArtworkFile {
  /** File ID */
  id: string;
  /** File name for display */
  filename: string;
  /** Google Drive file ID for streaming */
  driveFileId: string | null;
}

interface ImageSelectionGridProps {
  /** Type of images to display (affects aspect ratio) */
  type: "poster" | "backdrop";
  /** TMDB images sorted by vote average */
  tmdbImages: TMDBImage[];
  /** Existing uploaded artwork files */
  existingFiles?: ExistingArtworkFile[];
  /** Currently selected image path (TMDB) or file ID (existing) */
  selectedValue: string | null;
  /** Callback when selection changes */
  onSelect: (value: string | null, source: "tmdb" | "existing") => void;
  /** Whether selection is skipped */
  isSkipped?: boolean;
  /** Callback when skip state changes */
  onSkipChange?: (skipped: boolean) => void;
  /** Whether the grid is disabled */
  disabled?: boolean;
  /** Maximum images to display initially */
  initialLimit?: number;
  /** Whether to show tabs (default true). Set false when embedded in parent tabs. */
  showTabs?: boolean;
}

/**
 * Reusable image selection grid with TMDB and existing files tabs.
 * Features elegant selection states with amber glow accents.
 *
 * @param type - "poster" (2:3) or "backdrop" (16:9)
 * @param tmdbImages - TMDB images to display
 * @param existingFiles - User's uploaded artwork files
 * @param selectedValue - Currently selected path or file ID
 * @param onSelect - Selection change callback
 * @param isSkipped - Whether selection is skipped
 * @param onSkipChange - Skip state change callback
 * @param disabled - Whether grid is disabled
 * @param initialLimit - Max images to show initially (default 9)
 * @param showTabs - Whether to show tabs (default true)
 */
export function ImageSelectionGrid({
  type,
  tmdbImages,
  existingFiles = [],
  selectedValue,
  onSelect,
  isSkipped = false,
  onSkipChange,
  disabled = false,
  initialLimit,
  showTabs = true,
}: ImageSelectionGridProps) {
  // Responsive limit: 8 on desktop, 9 on mobile (if not explicitly set)
  const isMobile = useIsMobile();
  const baseLimit = initialLimit ?? (isMobile ? 9 : 8);

  // Track displayed count - null means use baseLimit (allows responsive updates)
  const [displayCount, setDisplayCount] = useState<number | null>(null);
  const effectiveDisplayCount = displayCount ?? baseLimit;
  const [activeTab, setActiveTab] = useState<"tmdb" | "existing">("tmdb");

  // Limit displayed TMDB images with incremental loading
  const displayedTmdbImages = useMemo(() => {
    return tmdbImages.slice(0, effectiveDisplayCount);
  }, [tmdbImages, effectiveDisplayCount]);

  /**
   * Gets the thumbnail URL for a TMDB image.
   */
  const getThumbnailUrl = useCallback(
    (filePath: string) => {
      return type === "poster"
        ? getPosterUrl(filePath, "w185")
        : getBackdropUrl(filePath, "w300");
    },
    [type]
  );

  const hasMoreImages = tmdbImages.length > effectiveDisplayCount;
  const remainingCount = tmdbImages.length - effectiveDisplayCount;
  const hasExistingFiles = existingFiles.length > 0;

  /**
   * Handles image selection.
   */
  const handleSelect = useCallback(
    (value: string, source: "tmdb" | "existing") => {
      if (disabled || isSkipped) return;
      // Toggle off if already selected
      if (selectedValue === value) {
        onSelect(null, source);
      } else {
        onSelect(value, source);
      }
    },
    [disabled, isSkipped, selectedValue, onSelect]
  );

  // Aspect ratio classes based on type
  const aspectClass = type === "poster" ? "aspect-[2/3]" : "aspect-video";
  const gridCols =
    type === "poster"
      ? "grid-cols-3 sm:grid-cols-4"
      : "grid-cols-2 sm:grid-cols-3";

  // TMDB images grid content (shared between tabs and no-tabs mode)
  const tmdbGridContent =
    tmdbImages.length === 0 ? (
      <EmptyState message="No images available from TMDB" />
    ) : (
      <>
        <div className={cn("grid gap-2", gridCols)}>
          {displayedTmdbImages.map((image, index) => (
            <ImageThumbnail
              key={image.file_path}
              src={getThumbnailUrl(image.file_path)}
              alt={`Option ${index + 1}`}
              aspectClass={aspectClass}
              isSelected={selectedValue === image.file_path}
              isSkipped={isSkipped}
              disabled={disabled}
              onClick={() => handleSelect(image.file_path, "tmdb")}
              badge={`${image.width}x${image.height}`}
              isTextless={image.iso_639_1 === null}
            />
          ))}
        </div>

        {hasMoreImages && (
          <button
            type="button"
            onClick={() =>
              setDisplayCount((prev) => (prev ?? baseLimit) + baseLimit)
            }
            disabled={disabled}
            className={cn(
              "text-muted-foreground hover:text-foreground mt-3 w-full text-center text-sm transition-colors",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            Show {Math.min(baseLimit, remainingCount)} more images
          </button>
        )}
      </>
    );

  // When showTabs is false, render just the TMDB grid (used when embedded in parent tabs)
  if (!showTabs) {
    return <div className="space-y-4">{tmdbGridContent}</div>;
  }

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "tmdb" | "existing")}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tmdb" disabled={disabled}>
            <Globe className="mr-1.5 size-3.5" />
            From TMDB
            {tmdbImages.length > 0 && (
              <span className="bg-muted ml-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums">
                {tmdbImages.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="existing"
            disabled={disabled || !hasExistingFiles}
          >
            My Uploads
            {hasExistingFiles && (
              <span className="bg-muted ml-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums">
                {existingFiles.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TMDB Images Tab */}
        <TabsContent value="tmdb" className="mt-4">
          {tmdbGridContent}
        </TabsContent>

        {/* Existing Files Tab */}
        <TabsContent value="existing" className="mt-4">
          {!hasExistingFiles ? (
            <EmptyState message="No uploaded artwork yet" />
          ) : (
            <div className={cn("grid gap-2", gridCols)}>
              {existingFiles.map((file) => (
                <ExistingFileThumbnail
                  key={file.id}
                  file={file}
                  aspectClass={aspectClass}
                  isSelected={selectedValue === file.id}
                  isSkipped={isSkipped}
                  disabled={disabled}
                  onClick={() => handleSelect(file.id, "existing")}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Skip checkbox */}
      {onSkipChange && (
        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id="skip-selection"
            checked={isSkipped}
            onCheckedChange={(checked) => onSkipChange(checked === true)}
            disabled={disabled}
          />
          <Label
            htmlFor="skip-selection"
            className={cn(
              "flex cursor-pointer items-center gap-1.5 text-sm",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <SkipForward className="size-3.5" />
            Skip {type} selection
          </Label>
        </div>
      )}
    </div>
  );
}

/**
 * Props for image thumbnail component.
 */
interface ImageThumbnailProps {
  src: string | null;
  alt: string;
  aspectClass: string;
  isSelected: boolean;
  isSkipped: boolean;
  disabled: boolean;
  onClick: () => void;
  badge?: string;
  isTextless?: boolean;
}

/**
 * Individual TMDB image thumbnail with selection state.
 * Uses useImageLoaded hook for cached image detection.
 */
function ImageThumbnail({
  src,
  alt,
  aspectClass,
  isSelected,
  isSkipped,
  disabled,
  onClick,
  badge,
  isTextless,
}: ImageThumbnailProps) {
  const {
    ref,
    loaded: isLoaded,
    error: hasError,
    onLoad,
    onError,
  } = useImageLoaded(src ?? undefined);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "bg-muted flex items-center justify-center rounded-lg border",
          aspectClass
        )}
      >
        <ImageOff className="text-muted-foreground/50 size-6" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isSkipped}
      className={cn(
        "bg-muted group relative overflow-hidden rounded-lg transition-[transform,opacity,box-shadow] duration-200",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        aspectClass,
        // Selection states
        isSelected &&
          !isSkipped && [
            "ring-offset-background ring-2 ring-amber-500 ring-offset-2",
            "shadow-[0_0_20px_rgba(245,158,11,0.3)]",
          ],
        !isSelected &&
          !isSkipped &&
          !disabled && [
            "hover:ring-muted-foreground/30 hover:ring-offset-background hover:ring-2 hover:ring-offset-2",
            "hover:scale-[1.02]",
          ],
        isSkipped && "opacity-40",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {/* Image icon placeholder while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <ImageIcon className="text-muted-foreground/50 size-8" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading="lazy"
        className={cn(
          "absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-150",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={onLoad}
        onError={onError}
      />

      {/* Selection checkmark overlay */}
      {isSelected && !isSkipped && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="flex size-8 items-center justify-center rounded-full bg-amber-500 shadow-lg">
            <Check className="size-5 text-white" />
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="absolute right-1 bottom-1 left-1 flex items-end justify-between">
        {badge && (
          <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90 tabular-nums">
            {badge}
          </span>
        )}
        {isTextless && (
          <span className="rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Textless
          </span>
        )}
      </div>

      {/* Hover overlay for non-selected items */}
      {!isSelected && !isSkipped && !disabled && (
        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
      )}
    </button>
  );
}

/**
 * Props for existing file thumbnail.
 */
interface ExistingFileThumbnailProps {
  file: ExistingArtworkFile;
  aspectClass: string;
  isSelected: boolean;
  isSkipped: boolean;
  disabled: boolean;
  onClick: () => void;
}

/**
 * Thumbnail for user's existing uploaded artwork file.
 * Uses useImageLoaded hook for cached image detection.
 */
function ExistingFileThumbnail({
  file,
  aspectClass,
  isSelected,
  isSkipped,
  disabled,
  onClick,
}: ExistingFileThumbnailProps) {
  // Stream from our artwork API
  const src = file.driveFileId ? `/api/artwork/${file.driveFileId}` : null;
  const {
    ref,
    loaded: isLoaded,
    error: hasError,
    onLoad,
    onError,
  } = useImageLoaded(src ?? undefined);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "bg-muted flex flex-col items-center justify-center gap-1 rounded-lg border p-2",
          aspectClass
        )}
      >
        <ImageOff className="text-muted-foreground/50 size-5" />
        <span className="text-muted-foreground max-w-full truncate text-xs">
          {file.filename}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isSkipped}
      className={cn(
        "bg-muted group relative overflow-hidden rounded-lg transition-[transform,opacity,box-shadow] duration-200",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        aspectClass,
        isSelected &&
          !isSkipped && [
            "ring-offset-background ring-2 ring-amber-500 ring-offset-2",
            "shadow-[0_0_20px_rgba(245,158,11,0.3)]",
          ],
        !isSelected &&
          !isSkipped &&
          !disabled && [
            "hover:ring-muted-foreground/30 hover:ring-offset-background hover:ring-2 hover:ring-offset-2",
            "hover:scale-[1.02]",
          ],
        isSkipped && "opacity-40",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {/* Image icon placeholder while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <ImageIcon className="text-muted-foreground/50 size-8" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={file.filename}
        loading="lazy"
        data-testid="image"
        className={cn(
          "absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-150",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={onLoad}
        onError={onError}
      />

      {/* Selection checkmark overlay */}
      {isSelected && !isSkipped && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
          <div className="flex size-8 items-center justify-center rounded-full bg-amber-500 shadow-lg">
            <Check className="size-5 text-white" />
          </div>
        </div>
      )}

      {/* Filename badge */}
      <div className="absolute right-1 bottom-1 left-1">
        <span className="block truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
          {file.filename}
        </span>
      </div>

      {!isSelected && !isSkipped && !disabled && (
        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
      )}
    </button>
  );
}

/**
 * Empty state component for tabs.
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
      <ImageOff className="text-muted-foreground/50 size-8" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
