/**
 * Interactive poster card with context menu wrapper.
 * Combines DemoPosterCard with DemoContextMenu for right-click actions.
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DemoProgressBar } from "./demo-progress-bar";
import { DemoContextMenu } from "./demo-context-menu";

interface DemoInteractivePosterCardProps {
  /** Poster image URL (full TMDB URL). */
  posterUrl: string | null;
  /** Item title. */
  title: string;
  /** Optional description (shown on hover). */
  description?: string;
  /** Optional owner info (shown on hover). */
  owner?: { name: string; username: string };
  /** Progress percentage (0-100). */
  progress?: number;
  /** Link destination. */
  href?: string;
  /** Whether the item is pinned. */
  isPinned?: boolean;
  /** Whether to show "Add Child Item" in context menu. */
  showAddChild?: boolean;
  /** Whether to show "Fork" in context menu (for public items). */
  showFork?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Poster card with integrated context menu for demo interactions.
 * Right-click shows Settings, Pin, Delete, Add Child options.
 */
export function DemoInteractivePosterCard({
  posterUrl,
  title,
  description,
  owner,
  progress,
  href = "/demo/apple-tv-redesign/item",
  isPinned = false,
  showAddChild = true,
  showFork = false,
  className,
}: DemoInteractivePosterCardProps) {
  return (
    <DemoContextMenu
      itemName={title}
      isPinned={isPinned}
      showAddChild={showAddChild}
      showFork={showFork}
    >
      <Link
        href={href}
        className={cn(
          "group relative block overflow-hidden rounded-lg",
          "aspect-[2/3]",
          "bg-[var(--atv-surface)]",
          "transition-all duration-300 ease-out",
          "hover:z-10 hover:scale-105",
          "hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
          "focus-visible:z-10 focus-visible:scale-105",
          "focus-visible:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none",
          "active:scale-[0.98] active:transition-transform active:duration-100",
          className
        )}
      >
        {/* Poster Image */}
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--atv-surface)] to-[var(--atv-bg)]">
            <span className="text-4xl font-bold text-white/20">
              {title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Default Gradient */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
          }}
          aria-hidden="true"
        />

        {/* Title (always visible) */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3
            className={cn(
              "truncate text-sm font-semibold tracking-tight",
              "text-white drop-shadow-lg",
              "md:text-base"
            )}
          >
            {title}
          </h3>
        </div>

        {/* Hover/Focus Overlay */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-end p-3",
            "opacity-0 transition-opacity duration-200",
            "group-hover:opacity-100 group-focus-visible:opacity-100"
          )}
          style={{ background: "var(--atv-gradient-card)" }}
          aria-hidden="true"
        >
          <h3
            className={cn(
              "text-sm font-semibold tracking-tight",
              "text-white",
              "md:text-base"
            )}
          >
            {title}
          </h3>

          {description && (
            <p className="mt-1 line-clamp-2 text-xs text-white/60 md:text-sm">
              {description}
            </p>
          )}

          {owner && (
            <p className="mt-1 text-xs text-white/50">@{owner.username}</p>
          )}

          {typeof progress === "number" && (
            <div className="mt-2">
              <DemoProgressBar progress={progress} compact />
            </div>
          )}
        </div>
      </Link>
    </DemoContextMenu>
  );
}
