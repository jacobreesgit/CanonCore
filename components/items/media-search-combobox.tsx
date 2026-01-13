/**
 * MediaSearchCombobox - Auto-suggest combobox for TMDB media search.
 * Shows movie/TV results with poster thumbnails as user types.
 * Uses Radix Popover for proper portal handling inside dialogs.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Film, Tv, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { searchMediaAction, isTMDBAvailable } from "@/lib/tmdb-actions";
import { getPosterUrl, type TMDBSearchResult } from "@/lib/tmdb-client";
import { cn } from "@/lib/utils";

/**
 * Poster thumbnail with load state tracking for smooth fade-in.
 * Shows film icon placeholder while loading.
 *
 * @param posterPath - TMDB poster path
 */
function PosterThumbnail({ posterPath }: { posterPath: string }) {
  const [loaded, setLoaded] = useState(false);
  const posterUrl = getPosterUrl(posterPath, "w92");

  return (
    <div className="bg-muted relative h-14 w-10 shrink-0 overflow-hidden rounded">
      {/* Film icon placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Film className="text-muted-foreground/50 size-5" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={posterUrl ?? undefined}
        alt=""
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-150",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
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

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
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
  }, [query]);

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
   * Handles input focus - only open if there's existing query to search.
   */
  const handleFocus = useCallback(() => {
    if (query.length >= 2) {
      setOpen(true);
    }
  }, [query]);

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

  // Loading state while checking TMDB availability
  if (tmdbAvailable === null) {
    return (
      <Input id={id} placeholder={placeholder} disabled className={className} />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            id={id}
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            placeholder={placeholder}
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            autoComplete="off"
            className="pl-10"
          />
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Empty State - Type to search */}
        {!isLoading && !hasSearched && query.length < 2 && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Search className="text-muted-foreground/50 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              Type to search movies & TV shows
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            <span className="text-muted-foreground text-sm">
              Searching TMDB...
            </span>
          </div>
        )}

        {/* No Results */}
        {!isLoading && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Search className="text-muted-foreground/50 h-8 w-8" />
            <p className="text-muted-foreground text-sm">No results found</p>
          </div>
        )}

        {/* Results List */}
        {!isLoading && results.length > 0 && (
          <div
            className="max-h-[280px] overflow-y-auto p-1"
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
                  "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                  "cursor-pointer transition-colors"
                )}
              >
                {/* Poster Thumbnail */}
                {result.posterPath ? (
                  <PosterThumbnail posterPath={result.posterPath} />
                ) : (
                  <div className="bg-muted flex h-14 w-10 shrink-0 items-center justify-center rounded">
                    {result.mediaType === "movie" ? (
                      <Film className="text-muted-foreground h-5 w-5" />
                    ) : (
                      <Tv className="text-muted-foreground h-5 w-5" />
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
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
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
        )}
      </PopoverContent>
    </Popover>
  );
}
