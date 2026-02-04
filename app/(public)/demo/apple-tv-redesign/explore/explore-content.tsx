/**
 * Client component for Explore page interactive content.
 * Handles sort/filter state and fork dialog.
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DemoSortDropdown,
  DemoMobileOptionsSheet,
  DemoInteractivePosterCard,
  DemoPosterGrid,
} from "../components";

interface ExploreItem {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterUrl: string | null;
  overview: string;
  owner: { name: string; username: string };
  progress?: number;
}

interface ExploreContentProps {
  items: ExploreItem[];
}

/**
 * Interactive content for the Explore page.
 * Includes sort dropdown, mobile options sheet, and fork dialog.
 */
export function ExploreContent({ items }: ExploreContentProps) {
  const [sortValue, setSortValue] = useState("updated-desc");
  const [filterValue, setFilterValue] = useState("all");

  return (
    <>
      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between">
        <h2
          className={cn(
            "text-xs font-medium tracking-[0.2em] uppercase",
            "text-[var(--atv-text-tertiary)]"
          )}
        >
          Recently Shared
        </h2>
        <div className="flex items-center gap-2">
          {/* Desktop: Sort dropdown */}
          <div className="hidden md:block">
            <DemoSortDropdown value={sortValue} onChange={setSortValue} />
          </div>
          {/* Mobile: Options sheet */}
          <DemoMobileOptionsSheet
            sortValue={sortValue}
            onSortChange={setSortValue}
            filterValue={filterValue}
            onFilterChange={setFilterValue}
          />
        </div>
      </div>

      {/* Grid */}
      <DemoPosterGrid>
        {items.map((item) => (
          <DemoInteractivePosterCard
            key={`${item.mediaType}-${item.id}`}
            posterUrl={item.posterUrl}
            title={item.title}
            description={item.overview}
            owner={item.owner}
            progress={item.progress}
            href="/demo/apple-tv-redesign/item"
            showAddChild={false}
            showFork={true}
          />
        ))}
      </DemoPosterGrid>
    </>
  );
}
