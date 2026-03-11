/**
 * TMDB source field with inline detach action.
 * Mirrors the DOM structure and styling of FileTypeCombobox (select mode)
 * for visual consistency across the Details and TMDB tabs.
 */

"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faDatabase,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { clearTmdbFieldAction } from "@/lib/tmdb-actions";
import { getPosterUrl } from "@/lib/tmdb-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TmdbSourceFieldProps {
  item: {
    id: string;
    tmdbId: number | null;
    tmdbType: string | null;
    tmdbPosterPath: string | null;
    name: string;
  };
  /** Callback when user clicks the trigger to search/change TMDB match */
  onChange: () => void;
  /** Callback after detach completes (for refetching data) */
  onSettingsChange: () => Promise<void>;
}

export function TmdbSourceField({
  item,
  onChange,
  onSettingsChange,
}: TmdbSourceFieldProps) {
  const [showDetachDialog, setShowDetachDialog] = useState(false);
  const [isDetaching, setIsDetaching] = useState(false);

  const loading = isDetaching;
  const isLinked = item.tmdbId !== null;
  const posterUrl = getPosterUrl(item.tmdbPosterPath, "w92");
  const typeLabel = item.tmdbType === "tv" ? "TV" : "Movie";

  const handleDetach = useCallback(async () => {
    setIsDetaching(true);
    try {
      const result = await clearTmdbFieldAction(item.id, "all");
      if (result.success) {
        toast.success("TMDB metadata detached");
        await onSettingsChange();
        setShowDetachDialog(false);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to detach TMDB metadata");
    } finally {
      setIsDetaching(false);
    }
  }, [item.id, onSettingsChange]);

  return (
    <div className="space-y-3">
      {/* Header — mirrors FileTypeCombobox */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            "bg-primary/10"
          )}
        >
          <FontAwesomeIcon
            icon={faDatabase}
            className="text-primary size-3.5"
            aria-hidden="true"
          />
        </div>
        <label htmlFor="tmdb-source" className="text-sm font-medium">
          TMDB Source
        </label>
      </div>
      <p className="text-muted-foreground text-xs">
        The movie or TV show linked to this item.
      </p>

      {/* Trigger — mirrors FileTypeCombobox select-mode Button */}
      <Button
        id="tmdb-source"
        type="button"
        variant="outline"
        aria-label={isLinked ? `${typeLabel} · ${item.name}` : "Search TMDB"}
        disabled={loading}
        onClick={onChange}
        className={cn(
          "h-10 w-full justify-between font-normal",
          !isLinked && "text-muted-foreground"
        )}
      >
        {isLinked ? (
          <span className="flex min-w-0 items-center gap-2">
            {posterUrl && (
              <div
                className={cn(
                  "size-5",
                  "bg-muted relative shrink-0 overflow-hidden rounded"
                )}
              >
                <Image
                  src={posterUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="20px"
                />
              </div>
            )}
            <span className="truncate">
              <span className="text-muted-foreground">{typeLabel}</span>
              <span className="text-muted-foreground mx-1">&middot;</span>
              {item.name}
            </span>
          </span>
        ) : (
          <span>Search TMDB&hellip;</span>
        )}
        <span className="flex shrink-0 items-center gap-2">
          {isLinked && (
            <span
              role="button"
              tabIndex={loading ? -1 : 0}
              aria-label="Detach TMDB"
              aria-disabled={loading || undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (!loading) setShowDetachDialog(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!loading) setShowDetachDialog(true);
                }
              }}
              className={cn(
                "text-muted-foreground hover:text-destructive rounded p-1 transition-colors",
                "hover:bg-destructive/10",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                loading && "pointer-events-none opacity-50"
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

      {/* Detach confirmation */}
      <AlertDialog open={showDetachDialog} onOpenChange={setShowDetachDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detach TMDB Metadata</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will remove all TMDB metadata (ID, type, poster
              path, backdrop path) and reset display options. Your item name,
              description, and uploaded files will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDetach}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
