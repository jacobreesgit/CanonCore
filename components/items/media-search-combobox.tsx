/**
 * MediaSearchCombobox - Auto-suggest combobox for TMDB media search.
 * Shows movie/TV results with poster thumbnails as user types.
 * Uses Radix Popover for proper portal handling inside dialogs.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Film, Tv, Search, Loader2 } from "lucide-react";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { searchMediaAction, isTMDBAvailable } from "@/lib/tmdb-actions";
import { getPosterUrl, type TMDBSearchResult } from "@/lib/tmdb-client";
import { cn } from "@/lib/utils";

/**
 * Poster thumbnail with load state tracking for smooth fade-in.
 * Uses useImageLoaded hook for cached image detection.
 *
 * @param posterPath - TMDB poster path
 */
function PosterThumbnail({ posterPath }: { posterPath: string }) {
  const posterUrl = getPosterUrl(posterPath, "w92") ?? undefined;
  const { ref, loaded, onLoad, onError } = useImageLoaded(posterUrl);

  return (
    <div className="bg-muted relative h-14 w-10 shrink-0 overflow-hidden rounded">
      {/* Film icon placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Film
            className="text-muted-foreground/50 size-5"
            aria-hidden="true"
          />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={posterUrl}
        alt=""
        loading="lazy"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-150",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
}

interface MediaSearchComboboxProps {
  /** Called when user selects a result */
  onSelect: (result: TMDBSearchResult) => void;
  /** Called when input value changes (for manual typing) */
  onChange?: (value: string) => void;
  /** Current value to display */
  value?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** Input element id for label association */
  id?: string;
}

/**
 * Auto-suggest combobox for TMDB media search.
 * Shows movie/TV results with poster thumbnails as user types.
 */
export function MediaSearchCombobox({
  onSelect,
  onChange,
  value = "",
  placeholder = "Search movies & TV shows...",
  className,
  id,
}: MediaSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [tmdbAvailable, setTmdbAvailable] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if TMDB is configured
  useEffect(() => {
    isTMDBAvailable().then(setTmdbAvailable);
  }, []);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced search (skip while TMDB availability is unknown)
  useEffect(() => {
    if (!tmdbAvailable || !query.trim() || query.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      const response = await searchMediaAction(query);
      if (response.success && response.data) {
        setResults(response.data);
      } else {
        setResults([]);
      }
      setIsLoading(false);
      setHasSearched(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, tmdbAvailable]);

  /**
   * Handles result selection.
   */
  const handleSelect = useCallback(
    (result: TMDBSearchResult) => {
      setQuery(result.title);
      setOpen(false);
      setResults([]);
      setHasSearched(false);
      onSelect(result);
    },
    [onSelect]
  );

  /**
   * Handles input changes.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setQuery(newValue);
      onChange?.(newValue);
      if (newValue.length >= 2) {
        setOpen(true);
      }
    },
    [onChange]
  );

  /**
   * Handles input focus - open popover and re-trigger search if needed.
   * This handles the case where user returns from another view (e.g., TMDB wizard)
   * with a valid query but cleared results.
   */
  const handleFocus = useCallback(() => {
    if (!tmdbAvailable || query.length < 2) return;
    setOpen(true);
    // Re-trigger search if we have a valid query but no results
    // (e.g., after returning from TMDB wizard where results were cleared)
    if (results.length === 0 && !hasSearched && !isLoading) {
      setIsLoading(true);
      searchMediaAction(query).then((response) => {
        if (response.success && response.data) {
          setResults(response.data);
        } else {
          setResults([]);
        }
        setIsLoading(false);
        setHasSearched(true);
      });
    }
  }, [tmdbAvailable, query, results.length, hasSearched, isLoading]);

  // Fallback to simple input if TMDB not configured
  if (tmdbAvailable === false) {
    return (
      <Input
        id={id}
        placeholder="Enter name manually"
        value={query || ""}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange?.(e.target.value);
        }}
        autoComplete="off"
        className={className}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverAnchor asChild>
        <div className={cn("relative", className)}>
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id={id}
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? "media-search-listbox" : undefined}
            placeholder={placeholder}
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onClick={(e) => e.stopPropagation()}
            autoComplete="off"
            className="pl-10"
          />
        </div>
      </PopoverAnchor>

      <PopoverContent
        data-testid="tmdb-search-popover"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Empty State - Type to search */}
        {!isLoading && !hasSearched && query.length < 2 && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Search
              className="text-muted-foreground/50 size-8"
              aria-hidden="true"
            />
            <p className="text-muted-foreground text-sm">
              Type to search movies & TV shows
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2
              className="text-muted-foreground size-4 animate-spin"
              aria-hidden="true"
            />
            <span className="text-muted-foreground text-sm">
              Searching TMDB...
            </span>
          </div>
        )}

        {/* No Results */}
        {!isLoading && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Search
              className="text-muted-foreground/50 size-8"
              aria-hidden="true"
            />
            <p className="text-muted-foreground text-sm">No results found</p>
          </div>
        )}

        {/* Results List — always present for aria-controls reference */}
        <div
          id="media-search-listbox"
          className={cn(
            "max-h-[280px] overflow-y-auto p-1",
            (isLoading || results.length === 0) && "hidden"
          )}
          role="listbox"
          onWheel={(e) => {
            e.stopPropagation();
            e.currentTarget.scrollTop += e.deltaY;
          }}
        >
          {results.map((result) => (
            <button
              key={`${result.mediaType}-${result.id}`}
              type="button"
              role="option"
              onClick={() => handleSelect(result)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
                "cursor-pointer transition-colors"
              )}
            >
              {/* Poster Thumbnail */}
              {result.posterPath ? (
                <PosterThumbnail posterPath={result.posterPath} />
              ) : (
                <div className="bg-muted flex h-14 w-10 shrink-0 items-center justify-center rounded">
                  {result.mediaType === "movie" ? (
                    <Film
                      className="text-muted-foreground size-5"
                      aria-hidden="true"
                    />
                  ) : (
                    <Tv
                      className="text-muted-foreground size-5"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )}

              {/* Title and Metadata */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{result.title}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                      result.mediaType === "movie"
                        ? "bg-brand/15 text-brand"
                        : "bg-brand/15 text-brand"
                    )}
                  >
                    {result.mediaType === "movie" ? "Movie" : "TV"}
                  </span>
                  {result.year && (
                    <span className="text-muted-foreground text-xs">
                      {result.year}
                    </span>
                  )}
                </div>
                {result.overview && (
                  <p className="text-muted-foreground line-clamp-1 text-xs">
                    {result.overview}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
