/**
 * TMDB artwork field with thumbnail preview, change, and clear actions.
 * Mirrors the DOM structure and styling of FileTypeCombobox (select mode)
 * for visual consistency across the Files and TMDB tabs.
 */

"use client";

import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TmdbArtworkFieldProps {
  /** Label displayed above the trigger (e.g., "Poster", "Backdrop", "Still") */
  label: string;
  /** Description text below the label */
  description: string;
  /** Icon displayed in the header circle */
  icon: IconDefinition;
  /** Raw TMDB image path (e.g., "/abc123.jpg") */
  imagePath: string | null;
  /** Full image URL for thumbnail preview */
  imageUrl: string | null;
  /** Callback when user clicks the trigger to change artwork */
  onChange: () => void;
  /** Callback when user clicks the clear (trash) icon */
  onClear: () => void;
  /** Whether actions are disabled */
  isLoading?: boolean;
  /** Optional note rendered below the description (e.g., override indicator) */
  note?: React.ReactNode;
}

export function TmdbArtworkField({
  label,
  description,
  icon,
  imagePath,
  imageUrl,
  onChange,
  onClear,
  isLoading = false,
  note,
}: TmdbArtworkFieldProps) {
  const triggerId = `tmdb-artwork-${label.toLowerCase()}`;

  return (
    <div className="space-y-3">
      {/* Label and Description */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            "bg-primary/10"
          )}
        >
          <FontAwesomeIcon
            icon={icon}
            className="text-primary size-3.5"
            aria-hidden="true"
          />
        </div>
        <label htmlFor={triggerId} className="text-sm font-medium">
          {label}
        </label>
      </div>
      <p className="text-muted-foreground text-xs">{description}</p>
      {note && <p className="text-destructive text-xs">{note}</p>}

      {/* Trigger — mirrors FileTypeCombobox select-mode Button */}
      <Button
        id={triggerId}
        type="button"
        variant="outline"
        aria-label={
          imageUrl ? (imagePath ?? label) : `Change ${label.toLowerCase()}`
        }
        disabled={isLoading}
        onClick={onChange}
        className={cn(
          "h-10 w-full justify-between font-normal",
          !imageUrl && "text-muted-foreground"
        )}
      >
        {imageUrl ? (
          <span className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                "size-5",
                "bg-muted relative shrink-0 overflow-hidden rounded"
              )}
            >
              <Image
                src={imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="20px"
              />
            </div>
            <span className="truncate">{imagePath}</span>
          </span>
        ) : (
          <span>Change {label.toLowerCase()}&hellip;</span>
        )}
        <span className="flex shrink-0 items-center gap-2">
          {imagePath && (
            <span
              role="button"
              tabIndex={isLoading ? -1 : 0}
              aria-label={`Clear ${label.toLowerCase()}`}
              aria-disabled={isLoading || undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (!isLoading) onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isLoading) onClear();
                }
              }}
              className={cn(
                "text-muted-foreground hover:text-destructive rounded p-1 transition-colors",
                "hover:bg-destructive/10",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                isLoading && "pointer-events-none opacity-50"
              )}
            >
              <FontAwesomeIcon
                icon={faTrashCan}
                className="size-3.5"
                aria-hidden="true"
              />
            </span>
          )}
          <FontAwesomeIcon
            icon={faChevronDown}
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
        </span>
      </Button>
    </div>
  );
}
