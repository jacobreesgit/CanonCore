/**
 * Preferences tab for settings dialog.
 * Allows users to set default view mode and sort order.
 */

"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPreferences, updatePreferences } from "@/lib/user-actions";
import { SORT_OPTIONS } from "@/lib/item-utils";
import type { ViewMode, SortOption } from "@/lib/types";
import { toast } from "sonner";

/**
 * Tab content for user preferences.
 * Loads preferences from the server and saves changes immediately.
 */
export function PreferencesTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("custom");

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      const result = await getPreferences();
      if (result.success && result.data) {
        setViewMode(result.data.viewMode);
        setSortBy(result.data.sortBy);
      } else if (!result.success) {
        setError(result.error);
      }
      setIsLoading(false);
    }
    loadPreferences();
  }, []);

  const handleViewModeChange = async (value: string) => {
    const newViewMode = value as ViewMode;
    const previousValue = viewMode;
    setViewMode(newViewMode);

    const result = await updatePreferences({ viewMode: newViewMode });
    if (!result.success) {
      setViewMode(previousValue);
      toast.error(result.error ?? "Failed to save view mode");
    } else {
      toast.success("Preferences saved");
    }
  };

  const handleSortChange = async (value: string) => {
    const newSort = value as SortOption;
    const previousValue = sortBy;
    setSortBy(newSort);

    const result = await updatePreferences({ sortBy: newSort });
    if (!result.success) {
      setSortBy(previousValue);
      toast.error(result.error ?? "Failed to save sort preference");
    } else {
      toast.success("Preferences saved");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
        <span className="text-muted-foreground text-sm">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive py-8 text-center">
        <p>Failed to load preferences</p>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Mode */}
      <div className="space-y-3">
        <Label className="text-base font-medium">View Mode</Label>
        <p className="text-muted-foreground text-sm">
          Choose how items are displayed by default.
        </p>
        <RadioGroup
          value={viewMode}
          onValueChange={handleViewModeChange}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="grid" id="view-grid" />
            <Label htmlFor="view-grid" className="cursor-pointer font-normal">
              Grid
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="tree" id="view-tree" />
            <Label htmlFor="view-tree" className="cursor-pointer font-normal">
              Tree
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Default Sort */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Default Sort</Label>
        <p className="text-muted-foreground text-sm">
          Choose the default sort order for your items.
        </p>
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select sort order" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
