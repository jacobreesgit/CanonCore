/**
 * Wizard step for selecting a logo/title treatment from TMDB.
 * Logos are transparent PNGs with variable aspect ratios, displayed
 * with object-contain on a dark background (not object-cover like posters).
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faImage,
  faForwardStep,
  faGlobe,
} from "@fortawesome/free-solid-svg-icons";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getLogoUrl } from "@/lib/tmdb-client";
import { LogoThumbnail } from "@/components/items/logo-thumbnail";
import type { TMDBImage } from "@/lib/tmdb-client";
import type { ExistingArtworkFile } from "./image-selection-grid";
import type { ArtworkSelectionSource } from "@/lib/types";

interface LogoSelectionStepProps {
  /** TMDB logo images sorted by vote average */
  logos: TMDBImage[];
  /** Existing uploaded artwork files (for non-upload mode) */
  existingFiles?: ExistingArtworkFile[];
  /** Currently selected logo path or file ID */
  selectedValue: string | null;
  /** Selection source */
  selectedSource: ArtworkSelectionSource | null;
  /** Callback when selection changes */
  onSelect: (value: string | null, source: ArtworkSelectionSource) => void;
  /** Whether logo selection is skipped */
  isSkipped: boolean;
  /** Callback when skip state changes */
  onSkipChange: (skipped: boolean) => void;
  /** Whether step is disabled */
  disabled?: boolean;
}

/**
 * Logo selection step for the metadata wizard.
 * Displays logo images with object-contain on a dark checkerboard
 * background to properly render transparent PNGs.
 *
 * @param logos - TMDB logo images
 * @param existingFiles - User's uploaded artwork
 * @param selectedValue - Currently selected logo
 * @param selectedSource - Where the selection came from
 * @param onSelect - Selection change callback
 * @param isSkipped - Whether step is skipped
 * @param onSkipChange - Skip state callback
 * @param disabled - Whether step is disabled
 */
export function LogoSelectionStep({
  logos,
  existingFiles = [],
  selectedValue,
  selectedSource: _selectedSource,
  onSelect,
  isSkipped,
  onSkipChange,
  disabled = false,
}: LogoSelectionStepProps) {
  // Responsive limit: 8 on desktop, 9 on mobile
  const isMobile = useIsMobile();
  const baseLimit = isMobile ? 9 : 8;

  // Track displayed count — null means use baseLimit (allows responsive updates)
  const [displayCount, setDisplayCount] = useState<number | null>(null);
  const effectiveDisplayCount = displayCount ?? baseLimit;
  const [activeTab, setActiveTab] = useState<"tmdb" | "existing">("tmdb");

  // Limit displayed TMDB logos with incremental loading
  const displayedLogos = useMemo(() => {
    return logos.slice(0, effectiveDisplayCount);
  }, [logos, effectiveDisplayCount]);

  const hasMoreLogos = logos.length > effectiveDisplayCount;
  const remainingCount = logos.length - effectiveDisplayCount;
  const hasExistingFiles = existingFiles.length > 0;

  /**
   * Handles logo selection toggle.
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

  // TMDB logos grid content
  const tmdbGridContent =
    logos.length === 0 ? (
      <div className="bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
        <FontAwesomeIcon
          icon={faImage}
          className="text-muted-foreground/50 size-8"
        />
        <p className="text-muted-foreground text-sm">
          No logos available from TMDB
        </p>
      </div>
    ) : (
      <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {displayedLogos.map((image, index) => (
            <LogoThumbnail
              key={image.file_path}
              src={getLogoUrl(image.file_path, "w300")}
              alt={`Logo option ${index + 1}`}
              isSelected={selectedValue === image.file_path}
              isSkipped={isSkipped}
              disabled={disabled}
              onClick={() => handleSelect(image.file_path, "tmdb")}
            >
              <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90 tabular-nums">
                {image.width}x{image.height}
              </span>
              {image.iso_639_1 === "en" && (
                <span className="rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  English
                </span>
              )}
            </LogoThumbnail>
          ))}
        </div>

        {hasMoreLogos && (
          <button
            type="button"
            onClick={() =>
              setDisplayCount((prev) => (prev ?? baseLimit) + baseLimit)
            }
            disabled={disabled}
            className={cn(
              "text-muted-foreground hover:text-foreground mt-3 w-full text-center text-sm transition-colors",
              "focus-visible:ring-ring focus-visible:rounded-md focus-visible:ring-2 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            Show {Math.min(baseLimit, remainingCount)} more logos
          </button>
        )}
      </>
    );

  // Shared skip checkbox — rendered in both tab and non-tab layouts
  const skipCheckbox = (
    <div className="flex items-center gap-2 pt-2">
      <Checkbox
        id="skip-logo-selection"
        checked={isSkipped}
        onCheckedChange={(checked) => onSkipChange(checked === true)}
        disabled={disabled}
      />
      <Label
        htmlFor="skip-logo-selection"
        className={cn(
          "flex cursor-pointer items-center gap-1.5 text-sm",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <FontAwesomeIcon icon={faForwardStep} className="size-3.5" />
        Skip logo selection
      </Label>
    </div>
  );

  // If there are existing files, show tabs. Otherwise render TMDB grid directly.
  if (hasExistingFiles) {
    return (
      <div className="space-y-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "tmdb" | "existing")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tmdb" disabled={disabled}>
              <FontAwesomeIcon icon={faGlobe} className="mr-1.5 size-3.5" />
              From TMDB
              {logos.length > 0 && (
                <span className="bg-muted ml-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums">
                  {logos.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="existing" disabled={disabled}>
              My Uploads
              {existingFiles.length > 0 && (
                <span className="bg-muted ml-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums">
                  {existingFiles.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TMDB Logos Tab */}
          <TabsContent value="tmdb" className="mt-4">
            {tmdbGridContent}
          </TabsContent>

          {/* Existing Files Tab */}
          <TabsContent value="existing" className="mt-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {existingFiles.map((file) => (
                <LogoThumbnail
                  key={file.id}
                  src={
                    file.driveFileId ? `/api/artwork/${file.driveFileId}` : null
                  }
                  alt={file.filename}
                  isSelected={selectedValue === file.id}
                  isSkipped={isSkipped}
                  disabled={disabled}
                  onClick={() => handleSelect(file.id, "existing")}
                >
                  <span className="block truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
                    {file.filename}
                  </span>
                </LogoThumbnail>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {skipCheckbox}
      </div>
    );
  }

  // No existing files — render TMDB grid with skip checkbox
  return (
    <div className="space-y-4">
      {tmdbGridContent}
      {skipCheckbox}
    </div>
  );
}
