/**
 * Client component for Profile page interactive content.
 * Handles toolbar state, view toggle, and context menus.
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DemoToolbar,
  DemoMobileOptionsSheet,
  DemoInteractivePosterCard,
  DemoPosterGrid,
  DemoSection,
} from "../components";

interface ProfileItem {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterUrl: string | null;
  overview: string;
  progress?: number;
  isPinned?: boolean;
}

interface ProfileContentProps {
  pinnedItems: ProfileItem[];
  libraryItems: ProfileItem[];
}

type ViewMode = "grid" | "tree";

/**
 * Interactive content for the Profile page.
 * Includes toolbar with sort, filter, view toggle, and context menus on cards.
 */
export function ProfileContent({
  pinnedItems,
  libraryItems,
}: ProfileContentProps) {
  const [sortValue, setSortValue] = useState("custom");
  const [filterValue, setFilterValue] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  return (
    <>
      {/* Toolbar */}
      <DemoSection className="border-b border-[var(--atv-border)] py-4">
        {/* Desktop toolbar */}
        <div className="hidden md:block">
          <DemoToolbar
            sortValue={sortValue}
            onSortChange={setSortValue}
            filterValue={filterValue}
            onFilterChange={setFilterValue}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showViewToggle
            showSync
          />
        </div>
        {/* Mobile toolbar */}
        <div className="flex items-center justify-between md:hidden">
          <DemoMobileOptionsSheet
            sortValue={sortValue}
            onSortChange={setSortValue}
            filterValue={filterValue}
            onFilterChange={setFilterValue}
            className="md:hidden"
          />
        </div>
      </DemoSection>

      {/* Pinned Items */}
      <DemoSection className="py-8">
        <h2
          className={cn(
            "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
            "text-[var(--atv-text-tertiary)]"
          )}
        >
          Pinned
        </h2>

        <div className="grid grid-cols-3 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6">
          {pinnedItems.map((item) => (
            <DemoInteractivePosterCard
              key={`${item.mediaType}-${item.id}`}
              posterUrl={item.posterUrl}
              title={item.title}
              progress={item.progress}
              href="/demo/apple-tv-redesign/item"
              isPinned={true}
            />
          ))}
        </div>
      </DemoSection>

      {/* Library */}
      <DemoSection className="py-8">
        <h2
          className={cn(
            "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
            "text-[var(--atv-text-tertiary)]"
          )}
        >
          Library
        </h2>

        <DemoPosterGrid>
          {libraryItems.map((item) => (
            <DemoInteractivePosterCard
              key={`${item.mediaType}-${item.id}`}
              posterUrl={item.posterUrl}
              title={item.title}
              description={item.overview}
              progress={item.progress}
              href="/demo/apple-tv-redesign/item"
              isPinned={false}
            />
          ))}
        </DemoPosterGrid>
      </DemoSection>
    </>
  );
}
