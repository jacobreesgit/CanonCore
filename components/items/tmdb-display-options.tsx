/**
 * Shared TMDB display options editor.
 * Checkbox toggles for which TMDB data sections appear on item detail pages.
 * Used by both the TMDB wizard summary step and the Item Settings dialog.
 */

"use client";

import { Film } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { TmdbDisplayOptions } from "@/lib/types";

/** Display options toggle labels keyed by TmdbDisplayOptions field. */
const DISPLAY_OPTION_LABELS: {
  key: keyof TmdbDisplayOptions;
  label: string;
}[] = [
  { key: "showTagline", label: "Tagline" },
  { key: "showMetadata", label: "Metadata (year, runtime, rating)" },
  { key: "showGenres", label: "Genres" },
  { key: "showCast", label: "Cast" },
  { key: "showProviders", label: "Where to Watch" },
  { key: "showVideos", label: "Videos" },
];

interface TmdbDisplayOptionsEditorProps {
  /** Current display option values. */
  displayOptions: TmdbDisplayOptions;
  /** Callback when any option changes. */
  onChange: (updated: TmdbDisplayOptions) => void;
}

/**
 * Checkbox grid for toggling TMDB detail page sections.
 *
 * @param displayOptions - Current toggle states
 * @param onChange - Called with full updated options object on any toggle
 */
export function TmdbDisplayOptionsEditor({
  displayOptions,
  onChange,
}: TmdbDisplayOptionsEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Film className="text-muted-foreground h-4 w-4" aria-hidden="true" />
        <span className="font-medium">Detail Page Display</span>
      </div>
      <p className="text-muted-foreground text-xs">
        Choose which TMDB data appears on your item&apos;s detail page.
      </p>
      <div className="space-y-1.5">
        {DISPLAY_OPTION_LABELS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={displayOptions[key]}
              onCheckedChange={(checked) =>
                onChange({ ...displayOptions, [key]: !!checked })
              }
            />
            <span
              className={cn(!displayOptions[key] && "text-muted-foreground")}
            >
              {label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
