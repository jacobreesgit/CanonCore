/**
 * Contextual empty state component for items views.
 * Displays different messages and actions based on the current context.
 */

"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faFolderOpen,
  faFilterCircleXmark,
  faMagnifyingGlass,
  faMusic,
  faPlus,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateVariant =
  | "first-time"
  | "no-children"
  | "filter-empty"
  | "search-empty"
  | "public-profile-empty"
  | "public-item-empty"
  | "explore-empty"
  | "playlist-empty";

interface EmptyStateConfig {
  icon: IconDefinition;
  title: string;
  description: string;
  actionLabel: string;
  actionIcon: IconDefinition;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateVariant, EmptyStateConfig> = {
  "first-time": {
    icon: faFolder,
    title: "No items yet",
    description:
      "Create your first item to start organizing your media library.",
    actionLabel: "Add Item",
    actionIcon: faPlus,
  },
  "no-children": {
    icon: faFolderOpen,
    title: "No child items",
    description: "Add child items to organise content within this folder.",
    actionLabel: "Add Child",
    actionIcon: faPlus,
  },
  "filter-empty": {
    icon: faFilterCircleXmark,
    title: "No matching items",
    description:
      "No items match your current filter. Try adjusting your filter criteria.",
    actionLabel: "Clear Filter",
    actionIcon: faXmark,
  },
  "search-empty": {
    icon: faMagnifyingGlass,
    title: "No results found",
    description: "",
    actionLabel: "Clear search",
    actionIcon: faXmark,
  },
  "public-profile-empty": {
    icon: faFolder,
    title: "No public items yet",
    description:
      "This user hasn't shared any items publicly. Check back later!",
    actionLabel: "",
    actionIcon: faFolder,
  },
  "public-item-empty": {
    icon: faFolderOpen,
    title: "No child items",
    description: "This item doesn't have any children.",
    actionLabel: "",
    actionIcon: faFolderOpen,
  },
  "explore-empty": {
    icon: faFolder,
    title: "Nothing here yet",
    description:
      "Be the first to share your items! Make your profile public to have your items featured here.",
    actionLabel: "",
    actionIcon: faFolder,
  },
  "playlist-empty": {
    icon: faMusic,
    title: "No items in this playlist",
    description: "Add items to this playlist from your library.",
    actionLabel: "Add Items",
    actionIcon: faPlus,
  },
};

interface EmptyStateProps {
  /** The variant of empty state to display */
  variant: EmptyStateVariant;
  /** Optional callback for the action button */
  onAction?: () => void;
  /** Search query to display in the search-empty variant */
  searchQuery?: string;
  /** Optional custom class name */
  className?: string;
}

/**
 * Displays a contextual empty state based on the current view context.
 *
 * @param variant - The type of empty state to show
 * @param onAction - Callback when the action button is clicked
 * @param className - Additional CSS classes
 *
 * @example
 * // First-time user with no items
 * <EmptyState variant="first-time" onAction={() => setAddItemOpen(true)} />
 *
 * @example
 * // Filter yielded no results
 * <EmptyState variant="filter-empty" onAction={() => setFilterBy("all")} />
 */
export function EmptyState({
  variant,
  onAction,
  searchQuery,
  className,
}: EmptyStateProps) {
  const config = EMPTY_STATE_CONFIG[variant];

  const description =
    variant === "search-empty" && searchQuery ? (
      <>
        No results for &ldquo;
        <span className="text-foreground inline-block max-w-[20ch] truncate align-bottom font-medium">
          {searchQuery}
        </span>
        &rdquo;
      </>
    ) : (
      config.description
    );

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-5",
        "border-border/40 rounded-xl border-2 border-dashed",
        "from-muted/30 to-muted/10 bg-gradient-to-b",
        "mb-4 min-h-[280px] p-8",
        className
      )}
    >
      {/* Icon container with subtle gradient background */}
      <div
        className={cn(
          "relative flex size-20 items-center justify-center rounded-2xl",
          "from-muted/80 to-muted/40 bg-gradient-to-br",
          "ring-border/50 shadow-sm ring-1"
        )}
      >
        <FontAwesomeIcon
          icon={config.icon}
          className="text-muted-foreground/70 size-10"
        />
        {/* Subtle inner glow */}
        <div className="from-foreground/5 absolute inset-0 rounded-2xl bg-gradient-to-t to-transparent" />
      </div>

      {/* Text content */}
      <div className="max-w-xs text-center">
        <h3 className="text-foreground text-lg font-semibold tracking-tight text-balance">
          {config.title}
        </h3>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          {description}
        </p>
      </div>

      {/* Action button - only render when onAction provided AND actionLabel non-empty */}
      {onAction && config.actionLabel && (
        <Button
          onClick={onAction}
          variant="outline"
          size="sm"
          className={cn(
            "mt-1 gap-1.5",
            "shadow-xs hover:shadow-sm",
            "transition-shadow duration-200"
          )}
        >
          <FontAwesomeIcon icon={config.actionIcon} className="size-4" />
          {config.actionLabel}
        </Button>
      )}
    </div>
  );
}
